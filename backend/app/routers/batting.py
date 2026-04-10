from __future__ import annotations

import asyncio
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from typing import Optional

from app.config import settings
from app.core import player_id_map as pid_map
from app.services import fangraphs_service, statcast_service, job_service
from app.services.mlb_api_service import get_mlb_api_service

router = APIRouter(prefix="/batting", tags=["batting"])


@router.get("/{player_id}/stats/{season}")
async def get_batting_stats(player_id: int, season: int):
    """Full batting stat profile merging FanGraphs + Statcast aggregates."""
    import pandas as pd
    fg_data = {}
    try:
        df = fangraphs_service.get_batting_stats(season, min_pa=1)
        row = pd.DataFrame()

        # Try mlbam_id first with proper float comparison
        if "mlbam_id" in df.columns:
            row = df[df["mlbam_id"].eq(float(player_id)) | df["mlbam_id"].eq(player_id)]

        # Fallback: look up by fangraphs_id via Chadwick cross-reference
        if row.empty and "fangraphs_id" in df.columns:
            fg_id = pid_map.get_fangraphs_id(player_id)
            if not fg_id:
                m = fangraphs_service.build_mlbam_to_fangraphs_map()
                fg_id = m.get(player_id)
            if fg_id:
                row = df[df["fangraphs_id"].eq(float(fg_id)) | df["fangraphs_id"].eq(int(fg_id))]

        if not row.empty:
            fg_data = {k: (None if (v != v) else v) for k, v in row.iloc[0].to_dict().items()}
    except Exception as exc:
        fg_data = {"_fg_error": str(exc)}

    return {"season": season, "mlbam_id": player_id, **fg_data}


@router.get("/{player_id}/trend/{stat_key}")
async def get_batting_trend(
    player_id: int,
    stat_key: str,
    start_season: int = Query(default=2002),
    end_season: int = Query(default=settings.CURRENT_SEASON),
):
    """Year-by-year values for a single stat (for trend line charts)."""
    import pandas as pd
    # Pre-resolve fangraphs_id once
    fg_id = pid_map.get_fangraphs_id(player_id)
    if not fg_id:
        m = fangraphs_service.build_mlbam_to_fangraphs_map()
        fg_id = m.get(player_id)

    results = []
    for season in range(start_season, end_season + 1):
        try:
            df = fangraphs_service.get_batting_stats(season, min_pa=1)
            row = pd.DataFrame()

            if "mlbam_id" in df.columns:
                row = df[df["mlbam_id"].eq(float(player_id)) | df["mlbam_id"].eq(player_id)]

            if row.empty and fg_id and "fangraphs_id" in df.columns:
                row = df[df["fangraphs_id"].eq(float(fg_id)) | df["fangraphs_id"].eq(int(fg_id))]

            if not row.empty and stat_key in row.columns:
                val = row.iloc[0][stat_key]
                results.append({"season": season, "value": None if val != val else float(val)})
        except Exception:
            pass
    return {"player_id": player_id, "stat_key": stat_key, "trend": results}


@router.get("/{player_id}/career")
async def get_career_batting_stats(player_id: int):
    """Career batting stats (year-by-year + career totals) for a player."""
    from app.services.stats_service import get_career_batting_stats
    result = get_career_batting_stats(player_id)
    return {"mlbam_id": player_id, **result}


@router.post("/{player_id}/statcast")
async def request_batter_statcast(
    player_id: int,
    background_tasks: BackgroundTasks,
    start_dt: str = Query(default=f"{settings.CURRENT_SEASON}-03-20"),
    end_dt: str = Query(default=f"{settings.CURRENT_SEASON}-11-01"),
):
    """Kick off background Statcast pull. Returns job_id for polling."""
    job_id = job_service.create_job("batter_statcast", {"player_id": player_id, "start_dt": start_dt, "end_dt": end_dt})
    background_tasks.add_task(job_service.run_batter_statcast_job, job_id, player_id, start_dt, end_dt)
    return {"job_id": job_id, "status": "pending"}


@router.get("/{player_id}/spray-chart/{season}")
async def get_spray_chart(player_id: int, season: int):
    """Return cached spray chart data if available; otherwise trigger a job."""
    start_dt = f"{season}-03-20"
    end_dt = f"{season}-11-01"
    import pandas as pd
    from app.core import cache as c
    key = f"sc_batter_{player_id}_{start_dt}_{end_dt}"
    df = c.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if df is not None:
        import math
        import pandas as pd
        from app.services.statcast_service import aggregate_batter_statcast
        agg = aggregate_batter_statcast(df)
        def _safe(v):
            try:
                if pd.isna(v):
                    return None
            except (TypeError, ValueError):
                pass
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return None
            return v
        agg_safe = {k: _safe(v) for k, v in agg.items() if k != "spray_chart"}
        spray = [
            {sk: _safe(sv) for sk, sv in pt.items()}
            for pt in agg.get("spray_chart", [])
        ]
        return {"status": "ready", "data": spray, "aggregate": agg_safe}
    return {"status": "not_cached", "message": "POST /batting/{player_id}/statcast to trigger data fetch"}
