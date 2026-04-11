from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core import player_id_map
from app.routers import batting, comparison, contract_value, jobs, leaderboards, park_factors, pitching, players, search, teams

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: kick off background init and return immediately so health check passes
    logger.info("Starting MLB Analytics API...")
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _background_init)
    yield
    # Shutdown
    from app.services.mlb_api_service import get_mlb_api_service
    await get_mlb_api_service().close()
    logger.info("MLB Analytics API shut down")


def _background_init():
    """
    Runs in a thread-pool worker after startup so the health check passes immediately.
    Builds the player ID map (MLB API + optional Chadwick enrichment) then warms
    leaderboard cache from disk if present.
    """
    import asyncio as _asyncio

    # Build the player ID map in a fresh event loop (thread has no loop)
    try:
        loop = _asyncio.new_event_loop()
        loop.run_until_complete(player_id_map.build_map())
        loop.close()
    except Exception as exc:
        logger.warning(f"Player ID map build failed: {exc}")

    _warm_cache()


def _warm_cache():
    """
    Pre-load leaderboard data only when it is already on disk.
    On a cold deploy (empty cache dir) this is a no-op — data loads lazily
    on the first API request instead, avoiding OOM on startup.
    """
    import gc
    from app.core import cache as disk_cache
    from app.services import stats_service

    season = settings.CURRENT_SEASON
    bat_key = f"mlb_batting_full_{season}"
    pit_key = f"mlb_pitching_full_{season}"

    if disk_cache.disk_exists(bat_key):
        try:
            stats_service.get_batting_stats(season, min_pa=50)
            logger.info(f"Batting stats loaded from cache for {season}")
        except Exception as exc:
            logger.warning(f"Batting cache load failed: {exc}")
    else:
        logger.info(f"Batting cache absent — will build on first leaderboard request")

    gc.collect()

    if disk_cache.disk_exists(pit_key):
        try:
            stats_service.get_pitching_stats(season, min_ip=20)
            logger.info(f"Pitching stats loaded from cache for {season}")
        except Exception as exc:
            logger.warning(f"Pitching cache load failed: {exc}")
    else:
        logger.info(f"Pitching cache absent — will build on first leaderboard request")

    gc.collect()



app = FastAPI(
    title="MLB Analytics API",
    description="Advanced baseball statistics — batting, pitching, Statcast, and Park Favorability Index",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",  # all Vercel preview deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(players.router,     prefix=PREFIX)
app.include_router(batting.router,     prefix=PREFIX)
app.include_router(pitching.router,    prefix=PREFIX)
app.include_router(leaderboards.router, prefix=PREFIX)
app.include_router(comparison.router,  prefix=PREFIX)
app.include_router(park_factors.router, prefix=PREFIX)
app.include_router(teams.router,       prefix=PREFIX)
app.include_router(search.router,        prefix=PREFIX)
app.include_router(jobs.router,          prefix=PREFIX)
app.include_router(contract_value.router, prefix=PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "season": settings.CURRENT_SEASON}
