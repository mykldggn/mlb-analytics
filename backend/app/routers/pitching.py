from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from typing import Optional

from app.config import settings
from app.core import player_id_map as pid_map
from app.services import fangraphs_service, statcast_service, job_service
from app.services.mlb_api_service import MLBApiService, get_mlb_api_service

router = APIRouter(prefix="/pitching", tags=["pitching"])


@router.get("/{player_id}/stats/{season}")
async def get_pitching_stats(
    player_id: int,
    season: int,
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    """Full pitching stat profile: FanGraphs + MLB pitch arsenal."""
    import pandas as pd
    fg_data = {}
    try:
        df = fangraphs_service.get_pitching_stats(season, min_ip=1)
        row = pd.DataFrame()

        if "mlbam_id" in df.columns:
            row = df[df["mlbam_id"].eq(float(player_id)) | df["mlbam_id"].eq(player_id)]

        if row.empty and "fangraphs_id" in df.columns:
            fg_id = pid_map.get_fangraphs_id(player_id)
            if not fg_id:
                m = fangraphs_service.build_mlbam_to_fangraphs_map()
                fg_id = m.get(player_id)
            if fg_id:
                row = df[df["fangraphs_id"].eq(float(fg_id)) | df["fangraphs_id"].eq(int(fg_id))]

        # Final fallback: match by player name (handles new players not yet in Chadwick)
        if row.empty and "name" in df.columns:
            try:
                player_data = await mlb.get_player(player_id)
                if player_data:
                    full_name = player_data.get("fullName", "").lower()
                    last_name = player_data.get("lastName", "").lower()
                    if full_name:
                        name_col = df["name"].str.lower()
                        row = df[name_col == full_name]
                        if row.empty and last_name:
                            row = df[name_col.str.startswith(last_name)]
            except Exception:
                pass

        if not row.empty:
            fg_data = {k: (None if (v != v) else v) for k, v in row.iloc[0].to_dict().items()}
    except Exception as exc:
        fg_data = {"_fg_error": str(exc)}

    # Pitch arsenal from MLB Stats API
    arsenal = []
    try:
        arsenal = await mlb.get_pitch_arsenal(player_id, season)
    except Exception:
        pass

    return {"season": season, "mlbam_id": player_id, "pitch_arsenal": arsenal, **fg_data}


@router.get("/{player_id}/trend/{stat_key}")
async def get_pitching_trend(
    player_id: int,
    stat_key: str,
    start_season: int = Query(default=2002),
    end_season: int = Query(default=settings.CURRENT_SEASON),
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    import pandas as pd
    fg_id = pid_map.get_fangraphs_id(player_id)
    if not fg_id:
        m = fangraphs_service.build_mlbam_to_fangraphs_map()
        fg_id = m.get(player_id)

    # Name fallback for players not yet in Chadwick (e.g., recent debutants)
    player_full_name = None
    player_last_name = None
    if not fg_id:
        try:
            data = await mlb.get_player(player_id)
            if data:
                player_full_name = data.get("fullName", "").lower()
                player_last_name = data.get("lastName", "").lower()
        except Exception:
            pass

    results = []
    for season in range(start_season, end_season + 1):
        try:
            df = fangraphs_service.get_pitching_stats(season, min_ip=1)
            row = pd.DataFrame()

            if "mlbam_id" in df.columns:
                row = df[df["mlbam_id"].eq(float(player_id)) | df["mlbam_id"].eq(player_id)]

            if row.empty and fg_id and "fangraphs_id" in df.columns:
                row = df[df["fangraphs_id"].eq(float(fg_id)) | df["fangraphs_id"].eq(int(fg_id))]

            if row.empty and player_full_name and "name" in df.columns:
                name_col = df["name"].str.lower()
                row = df[name_col == player_full_name]
                if row.empty and player_last_name:
                    row = df[name_col.str.startswith(player_last_name)]

            if not row.empty and stat_key in row.columns:
                val = row.iloc[0][stat_key]
                results.append({"season": season, "value": None if val != val else float(val)})
        except Exception:
            pass
    return {"player_id": player_id, "stat_key": stat_key, "trend": results}


@router.get("/{player_id}/career")
async def get_career_pitching_stats(
    player_id: int,
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    """Career pitching stats (year-by-year + career totals) for a player."""
    import pandas as pd
    fg_id = pid_map.get_fangraphs_id(player_id)
    # -1 means Chadwick has no valid FG ID for this player (e.g. recent debutants)
    if not fg_id or fg_id <= 0:
        m = fangraphs_service.build_mlbam_to_fangraphs_map()
        candidate = m.get(player_id)
        fg_id = candidate if candidate and candidate > 0 else None

    debut_year = 2000
    try:
        data = await mlb.get_player(player_id)
        if data and data.get("mlbDebutDate"):
            debut_year = int(str(data["mlbDebutDate"])[:4])
        # Last-resort: find fangraphs_id from current season pitching stats by mlbam_id or name
        if not fg_id and data:
            df = fangraphs_service.get_pitching_stats(settings.CURRENT_SEASON, min_ip=1)
            if "mlbam_id" in df.columns and "fangraphs_id" in df.columns:
                hit = df[df["mlbam_id"].eq(float(player_id)) | df["mlbam_id"].eq(player_id)]
                if hit.empty and "name" in df.columns:
                    full_name = data.get("fullName", "").lower()
                    if full_name:
                        hit = df[df["name"].str.lower() == full_name]
                if not hit.empty:
                    raw_fg = hit.iloc[0].get("fangraphs_id")
                    if raw_fg is not None and raw_fg == raw_fg and int(float(raw_fg)) > 0:
                        fg_id = int(float(raw_fg))
    except Exception:
        pass

    if not fg_id:
        return {"mlbam_id": player_id, "fangraphs_id": None, "year_by_year": [], "career_totals": {}, "error": "FanGraphs ID not found"}

    result = fangraphs_service.get_career_pitching_stats(fg_id, debut_year)
    return {"mlbam_id": player_id, "fangraphs_id": fg_id, **result}


@router.post("/{player_id}/statcast")
async def request_pitcher_statcast(
    player_id: int,
    background_tasks: BackgroundTasks,
    start_dt: str = Query(default=f"{settings.CURRENT_SEASON}-03-20"),
    end_dt: str = Query(default=f"{settings.CURRENT_SEASON}-11-01"),
):
    job_id = job_service.create_job("pitcher_statcast", {"player_id": player_id})
    background_tasks.add_task(job_service.run_pitcher_statcast_job, job_id, player_id, start_dt, end_dt)
    return {"job_id": job_id, "status": "pending"}


@router.get("/{player_id}/pitch-zones/{season}")
async def get_pitch_zones(
    player_id: int,
    season: int,
    split: str = Query(default="all", description="all | vs_lhb | vs_rhb"),
    pitch_type: str = Query(default="all", description="all | FF | SL | CU | CH | SI | FC | ..."),
):
    """
    Return a 5×5 zone grid of pitch frequency for a pitcher.
    plate_x: -1.5 to 1.5 ft (0 = center), plate_z: 1.0 to 4.0 ft.
    Each cell = percentage of all pitches landing in that zone.
    """
    import numpy as np
    from app.core import cache as c

    start_dt = f"{season}-03-20"
    end_dt = f"{season}-11-01"
    key = f"sc_pitcher_{player_id}_{start_dt}_{end_dt}"
    df = c.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if df is None or df.empty:
        return {"status": "not_cached", "message": "Statcast data not loaded. Use the Statcast panel to load pitcher data first.", "grid": []}

    import pandas as pd
    df = df.copy()

    # Filter by batter handedness
    if split == "vs_lhb" and "stand" in df.columns:
        df = df[df["stand"] == "L"]
    elif split == "vs_rhb" and "stand" in df.columns:
        df = df[df["stand"] == "R"]

    # Filter by pitch type
    if pitch_type != "all" and "pitch_type" in df.columns:
        df = df[df["pitch_type"] == pitch_type]

    if df.empty:
        return {"status": "ready", "total_pitches": 0, "grid": [], "pitch_types": []}

    # Drop rows missing plate coordinates
    df = df[df["plate_x"].notna() & df["plate_z"].notna()]

    total = len(df)
    if total == 0:
        return {"status": "ready", "total_pitches": 0, "grid": [], "pitch_types": []}

    # 5×5 grid bins
    x_edges = [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5]
    z_edges = [1.0, 1.6, 2.2, 2.8, 3.4, 4.0]

    grid = []
    for zi in range(4, -1, -1):  # top-to-bottom for display
        row_data = []
        for xi in range(5):
            mask = (
                (df["plate_x"] >= x_edges[xi]) & (df["plate_x"] < x_edges[xi + 1]) &
                (df["plate_z"] >= z_edges[zi]) & (df["plate_z"] < z_edges[zi + 1])
            )
            count = int(mask.sum())
            pct = round(count / total * 100, 1)
            row_data.append({"count": count, "pct": pct})
        grid.append(row_data)

    # Available pitch types for the toggle
    available_pitch_types = []
    if "pitch_type" in df.columns:
        available_pitch_types = sorted(
            [str(pt) for pt in df["pitch_type"].dropna().unique() if str(pt)],
            key=lambda p: -len(df[df["pitch_type"] == p])
        )

    return {
        "status": "ready",
        "total_pitches": total,
        "grid": grid,
        "pitch_types": available_pitch_types,
        "split": split,
        "pitch_type_filter": pitch_type,
        # Strike zone reference: x ±0.71 ft, z 1.5–3.5 ft (average)
        "zone_x_edges": x_edges,
        "zone_z_edges": z_edges,
    }


@router.get("/{player_id}/pitch-movement/{season}")
async def get_pitch_movement(player_id: int, season: int):
    """Pitch movement data from cached Statcast; returns movement by pitch type."""
    start_dt = f"{season}-03-20"
    end_dt = f"{season}-11-01"
    from app.core import cache as c
    key = f"sc_pitcher_{player_id}_{start_dt}_{end_dt}"
    df = c.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if df is None:
        return {"status": "not_cached", "movement": []}

    from app.services.statcast_service import aggregate_pitcher_statcast
    agg = aggregate_pitcher_statcast(df)
    return {"status": "ready", "arsenal": agg.get("pitch_arsenal", []), "csw_pct": agg.get("csw_pct")}
