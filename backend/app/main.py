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
    _start_daily_refresh()
    yield
    # Shutdown
    from app.services.mlb_api_service import get_mlb_api_service
    await get_mlb_api_service().close()
    logger.info("MLB Analytics API shut down")


def _warm_cache():
    """Pre-load leaderboard data and Statcast for the top 100 players."""
    import threading
    from app.services import fangraphs_service

    season = settings.CURRENT_SEASON
    bat_df = pit_df = None

    try:
        bat_df = fangraphs_service.get_batting_stats(season, min_pa=50)
        logger.info(f"Batting stats pre-loaded for {season}")
    except Exception as exc:
        logger.warning(f"Could not pre-warm batting stats: {exc}")
    try:
        pit_df = fangraphs_service.get_pitching_stats(season, min_ip=20)
        logger.info(f"Pitching stats pre-loaded for {season}")
    except Exception as exc:
        logger.warning(f"Could not pre-warm pitching stats: {exc}")

    # Statcast warmup runs in its own thread so it doesn't block leaderboard startup
    t = threading.Thread(
        target=_warm_statcast,
        args=(bat_df, pit_df, season),
        daemon=True,
    )
    t.start()


def _warm_statcast(bat_df, pit_df, season: int, top_n: int = 100):
    """Fetch and cache Statcast data for the top N batters and pitchers by WAR."""
    from app.services import fangraphs_service, statcast_service
    from app.core import cache as disk_cache

    start_dt = f"{season}-03-20"
    end_dt   = f"{season}-11-01"

    # Reverse FanGraphs→MLBAM map (handles recent debutants missing from Chadwick)
    fg_to_mlbam: dict[int, int] = {}
    try:
        mlbam_to_fg = fangraphs_service.build_mlbam_to_fangraphs_map()
        fg_to_mlbam = {v: k for k, v in mlbam_to_fg.items() if v and v > 0}
    except Exception:
        pass

    def _pid(row) -> int | None:
        raw = row.get("mlbam_id")
        if raw and raw == raw:
            return int(raw)
        fg = row.get("fangraphs_id")
        if fg and fg == fg:
            return fg_to_mlbam.get(int(fg))
        return None

    # Top batters
    if bat_df is not None and "war" in bat_df.columns:
        top = bat_df.dropna(subset=["war"]).sort_values("war", ascending=False).head(top_n)
        warmed = skipped = 0
        for _, row in top.iterrows():
            pid = _pid(row)
            if not pid:
                continue
            key = f"sc_batter_{pid}_{start_dt}_{end_dt}"
            if disk_cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS) is not None:
                skipped += 1
                continue
            try:
                statcast_service.get_batter_statcast(pid, start_dt, end_dt)
                warmed += 1
            except Exception as exc:
                logger.warning(f"Statcast batter {pid} failed: {exc}")
        logger.info(f"Statcast batter warmup: {warmed} fetched, {skipped} already cached")

    # Top pitchers
    if pit_df is not None and "war" in pit_df.columns:
        top = pit_df.dropna(subset=["war"]).sort_values("war", ascending=False).head(top_n)
        warmed = skipped = 0
        for _, row in top.iterrows():
            pid = _pid(row)
            if not pid:
                continue
            key = f"sc_pitcher_{pid}_{start_dt}_{end_dt}"
            if disk_cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS) is not None:
                skipped += 1
                continue
            try:
                statcast_service.get_pitcher_statcast(pid, start_dt, end_dt)
                warmed += 1
            except Exception as exc:
                logger.warning(f"Statcast pitcher {pid} failed: {exc}")
        logger.info(f"Statcast pitcher warmup: {warmed} fetched, {skipped} already cached")


def _start_daily_refresh():
    """Daemon thread that re-runs the cache warmup every 24 hours."""
    import threading
    import time

    def _loop():
        while True:
            time.sleep(24 * 60 * 60)
            logger.info("Running daily Statcast cache refresh...")
            try:
                _warm_cache()
            except Exception as exc:
                logger.warning(f"Daily refresh error: {exc}")

    threading.Thread(target=_loop, daemon=True, name="daily-cache-refresh").start()


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
