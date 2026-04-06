from __future__ import annotations

import asyncio
from fastapi import APIRouter, Query
from typing import Optional

import pandas as pd

from app.config import settings
from app.core import player_id_map as pid_map
from app.core.stat_calculations import compute_percentile
from app.services import fangraphs_service
from app.services.mlb_api_service import headshot_url

router = APIRouter(prefix="/comparison", tags=["comparison"])


@router.get("/batting")
async def compare_batting(
    player_ids: str = Query(description="Comma-separated MLBAM player IDs"),
    season: int = Query(default=settings.CURRENT_SEASON),
):
    ids = [int(x.strip()) for x in player_ids.split(",") if x.strip()]
    df = fangraphs_service.get_batting_stats(season, min_pa=1)

    results = []
    for pid in ids:
        row = pd.DataFrame()
        if "mlbam_id" in df.columns:
            row = df[df["mlbam_id"].eq(float(pid)) | df["mlbam_id"].eq(pid)]
        if row.empty and "fangraphs_id" in df.columns:
            fg_id = pid_map.get_fangraphs_id(pid)
            if not fg_id:
                m = fangraphs_service.build_mlbam_to_fangraphs_map()
                fg_id = m.get(pid)
            if fg_id:
                row = df[df["fangraphs_id"].eq(float(fg_id)) | df["fangraphs_id"].eq(int(fg_id))]
        if row.empty:
            results.append({"mlbam_id": pid, "player_name": "Unknown", "stats": {}})
        else:
            r = {k: (None if v != v else v) for k, v in row.iloc[0].to_dict().items()}
            results.append({
                "mlbam_id": pid,
                "player_name": r.get("name", ""),
                "team": r.get("team"),
                "headshot_url": headshot_url(pid),
                "stats": r,
            })

    return {"season": season, "players": results}


@router.get("/pitching")
async def compare_pitching(
    player_ids: str = Query(description="Comma-separated MLBAM player IDs"),
    season: int = Query(default=settings.CURRENT_SEASON),
):
    ids = [int(x.strip()) for x in player_ids.split(",") if x.strip()]
    df = fangraphs_service.get_pitching_stats(season, min_ip=1)

    results = []
    for pid in ids:
        row = pd.DataFrame()
        if "mlbam_id" in df.columns:
            row = df[df["mlbam_id"].eq(float(pid)) | df["mlbam_id"].eq(pid)]
        if row.empty and "fangraphs_id" in df.columns:
            fg_id = pid_map.get_fangraphs_id(pid)
            if not fg_id:
                m = fangraphs_service.build_mlbam_to_fangraphs_map()
                fg_id = m.get(pid)
            if fg_id:
                row = df[df["fangraphs_id"].eq(float(fg_id)) | df["fangraphs_id"].eq(int(fg_id))]
        if row.empty:
            results.append({"mlbam_id": pid, "player_name": "Unknown", "stats": {}})
        else:
            r = {k: (None if v != v else v) for k, v in row.iloc[0].to_dict().items()}
            results.append({
                "mlbam_id": pid,
                "player_name": r.get("name", ""),
                "team": r.get("team"),
                "headshot_url": headshot_url(pid),
                "stats": r,
            })

    return {"season": season, "players": results}


def _find_player_row(pid: int, df: pd.DataFrame) -> pd.DataFrame:
    """Find a player's row by mlbam_id then fangraphs_id fallback."""
    row = pd.DataFrame()
    if "mlbam_id" in df.columns:
        row = df[df["mlbam_id"].eq(float(pid)) | df["mlbam_id"].eq(pid)]
    if row.empty and "fangraphs_id" in df.columns:
        fg_id = pid_map.get_fangraphs_id(pid)
        if not fg_id:
            m = fangraphs_service.build_mlbam_to_fangraphs_map()
            fg_id = m.get(pid)
        if fg_id:
            row = df[df["fangraphs_id"].eq(float(fg_id)) | df["fangraphs_id"].eq(int(fg_id))]
    return row


@router.get("/percentiles")
async def comparison_percentiles(
    player_ids: str = Query(description="Comma-separated MLBAM player IDs"),
    season: int = Query(default=settings.CURRENT_SEASON),
    group: str = Query(default="batting"),
):
    """Percentile ranks for each player against the full leaderboard population."""
    ids = [int(x.strip()) for x in player_ids.split(",") if x.strip()]

    LOWER_IS_BETTER = {"era", "fip", "xfip", "siera", "whip", "era_minus", "fip_minus", "k_pct", "bb_pct", "swstr_pct"}

    # Population DataFrame (qualified players — used for percentile distribution)
    if group == "batting":
        pop_df = fangraphs_service.get_batting_stats(season, min_pa=100)
        all_df = fangraphs_service.get_batting_stats(season, min_pa=1)
    else:
        pop_df = fangraphs_service.get_pitching_stats(season, min_ip=40)
        all_df = fangraphs_service.get_pitching_stats(season, min_ip=1)

    numeric_cols = pop_df.select_dtypes(include="number").columns.tolist()
    results = []
    for pid in ids:
        # Find the player's stats — first try qualified population, then full dataset
        row = _find_player_row(pid, pop_df)
        if row.empty:
            row = _find_player_row(pid, all_df)
        if row.empty:
            results.append({"mlbam_id": pid, "percentiles": {}})
            continue
        pcts = {}
        for col in numeric_cols:
            val = row.iloc[0].get(col)
            if val is None or val != val:  # None or NaN
                continue
            pcts[col] = compute_percentile(float(val), pop_df[col], lower_is_better=(col in LOWER_IS_BETTER))
        results.append({"mlbam_id": pid, "player_name": row.iloc[0].get("name", ""), "percentiles": pcts})

    return {"season": season, "group": group, "players": results}
