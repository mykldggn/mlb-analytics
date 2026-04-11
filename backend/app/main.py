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
    # Startup: build player ID map, warm leaderboard cache, and start Statcast warmup
    logger.info("Starting MLB Analytics API...")
    await player_id_map.build_map()
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _warm_cache)
    yield
    # Shutdown
    from app.services.mlb_api_service import get_mlb_api_service
    await get_mlb_api_service().close()
    logger.info("MLB Analytics API shut down")


def _warm_cache():
    """Pre-load leaderboard data for the current season."""
    import gc
    from app.services import stats_service

    season = settings.CURRENT_SEASON

    try:
        stats_service.get_batting_stats(season, min_pa=50)
        logger.info(f"Batting stats pre-loaded for {season}")
    except Exception as exc:
        logger.warning(f"Could not pre-warm batting stats: {exc}")

    # Release memory before loading pitching
    gc.collect()

    try:
        stats_service.get_pitching_stats(season, min_ip=20)
        logger.info(f"Pitching stats pre-loaded for {season}")
    except Exception as exc:
        logger.warning(f"Could not pre-warm pitching stats: {exc}")

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
