from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Query
from app.core.exceptions import JobNotFoundError
from app.core import cache as disk_cache
from app.services import job_service
from app.config import settings

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}")
async def get_job_status(job_id: str):
    job = job_service.get_job(job_id)
    if not job:
        raise JobNotFoundError(job_id)
    return {
        "job_id": job["id"],
        "status": job["status"],
        "progress": job["progress"],
        "error": job.get("error"),
        "created_at": job["created_at"],
    }


@router.post("/warmup-statcast")
async def warmup_statcast_batch(
    background_tasks: BackgroundTasks,
    season: int = Query(default=settings.CURRENT_SEASON),
    top_n: int = Query(default=100, description="Top N batters + pitchers to pre-cache"),
):
    """
    Pre-cache Statcast data for the top N batters and pitchers from the current season leaderboard.
    Skips players whose data is already cached. Returns counts of triggered vs already-cached jobs.
    """
    import pandas as pd
    from app.services import fangraphs_service

    start_dt = f"{season}-03-20"
    end_dt   = f"{season}-11-01"

    triggered = []
    already_cached = []

    # Build a reverse FanGraphs→MLBAM map for players missing mlbam_id in the leaderboard
    # (recent debutants like Skenes aren't yet in Chadwick so _enrich_with_mlbam leaves them blank)
    fg_to_mlbam: dict[int, int] = {}
    try:
        mlbam_to_fg = fangraphs_service.build_mlbam_to_fangraphs_map()
        fg_to_mlbam = {v: k for k, v in mlbam_to_fg.items() if v and v > 0}
    except Exception:
        pass

    def _resolve_mlbam(row: "pd.Series") -> int | None:
        """Return mlbam_id from the row or fall back to the reverse FG map."""
        raw = row.get("mlbam_id")
        if raw and raw == raw:  # not NaN
            return int(raw)
        fg_id = row.get("fangraphs_id")
        if fg_id and fg_id == fg_id:
            return fg_to_mlbam.get(int(fg_id))
        return None

    # Top batters (min 100 PA)
    try:
        bat_df = fangraphs_service.get_batting_stats(season, min_pa=100)
        if "war" in bat_df.columns:
            top_batters = (
                bat_df.dropna(subset=["war"])
                .sort_values("war", ascending=False)
                .head(top_n)
            )
            for _, row in top_batters.iterrows():
                pid = _resolve_mlbam(row)
                if not pid:
                    continue
                key = f"sc_batter_{pid}_{start_dt}_{end_dt}"
                if disk_cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS) is not None:
                    already_cached.append({"type": "batter", "player_id": pid})
                else:
                    job_id = job_service.create_job("batter_statcast", {"player_id": pid})
                    background_tasks.add_task(job_service.run_batter_statcast_job, job_id, pid, start_dt, end_dt)
                    triggered.append({"type": "batter", "player_id": pid, "job_id": job_id})
    except Exception:
        pass  # leaderboard unavailable — skip batters

    # Top pitchers (min 20 IP)
    try:
        pit_df = fangraphs_service.get_pitching_stats(season, min_ip=20)
        if "war" in pit_df.columns:
            top_pitchers = (
                pit_df.dropna(subset=["war"])
                .sort_values("war", ascending=False)
                .head(top_n)
            )
            for _, row in top_pitchers.iterrows():
                pid = _resolve_mlbam(row)
                if not pid:
                    continue
                key = f"sc_pitcher_{pid}_{start_dt}_{end_dt}"
                if disk_cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS) is not None:
                    already_cached.append({"type": "pitcher", "player_id": pid})
                else:
                    job_id = job_service.create_job("pitcher_statcast", {"player_id": pid})
                    background_tasks.add_task(job_service.run_pitcher_statcast_job, job_id, pid, start_dt, end_dt)
                    triggered.append({"type": "pitcher", "player_id": pid, "job_id": job_id})
    except Exception:
        pass  # leaderboard unavailable — skip pitchers

    return {
        "season": season,
        "triggered": len(triggered),
        "already_cached": len(already_cached),
        "jobs": triggered,
    }


@router.get("/{job_id}/result")
async def get_job_result(job_id: str):
    job = job_service.get_job(job_id)
    if not job:
        raise JobNotFoundError(job_id)
    if job["status"] != "complete":
        return {"status": job["status"], "data": None}
    result = job_service.get_job_result(job_id)
    return {"status": "complete", "data": result}
