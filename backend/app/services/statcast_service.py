from __future__ import annotations

"""
Statcast data via pybaseball.  Pitch-level queries are slow (10-30 sec),
so all results are disk-cached as Parquet files.
"""

import logging
from typing import Optional

import httpx
import numpy as np
import pandas as pd

from app.config import settings
from app.core import cache

logger = logging.getLogger(__name__)


def _import_pybaseball():
    try:
        import pybaseball as pb
        pb.cache.enable()
        return pb
    except ImportError:
        raise RuntimeError("pybaseball not installed")


# ---------------------------------------------------------------------------
# Raw Statcast pulls (disk-cached)
# ---------------------------------------------------------------------------

def get_batter_statcast(mlbam_id: int, start_dt: str, end_dt: str) -> pd.DataFrame:
    key = f"sc_batter_{mlbam_id}_{start_dt}_{end_dt}"
    df = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if df is not None:
        return df
    pb = _import_pybaseball()
    logger.info(f"Fetching Statcast batter {mlbam_id}: {start_dt} to {end_dt}")
    df = pb.statcast_batter(start_dt, end_dt, mlbam_id)
    if df is not None and not df.empty:
        cache.disk_save(key, df)
    return df if df is not None else pd.DataFrame()


def get_pitcher_statcast(mlbam_id: int, start_dt: str, end_dt: str) -> pd.DataFrame:
    key = f"sc_pitcher_{mlbam_id}_{start_dt}_{end_dt}"
    df = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if df is not None:
        return df
    pb = _import_pybaseball()
    logger.info(f"Fetching Statcast pitcher {mlbam_id}: {start_dt} to {end_dt}")
    df = pb.statcast_pitcher(start_dt, end_dt, mlbam_id)
    if df is not None and not df.empty:
        cache.disk_save(key, df)
    return df if df is not None else pd.DataFrame()


def get_season_statcast(start_dt: str, end_dt: str, team: Optional[str] = None) -> pd.DataFrame:
    """Bulk season Statcast for park factor computation."""
    key = f"sc_season_{start_dt}_{end_dt}_{team or 'all'}"
    df = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS * 7)
    if df is not None:
        return df
    pb = _import_pybaseball()
    logger.info(f"Fetching Statcast season {start_dt} to {end_dt}")
    df = pb.statcast(start_dt=start_dt, end_dt=end_dt)
    if df is not None and not df.empty:
        if team:
            df = df[df["home_team"] == team]
        cache.disk_save(key, df)
    return df if df is not None else pd.DataFrame()


# ---------------------------------------------------------------------------
# Batter aggregations
# ---------------------------------------------------------------------------

def aggregate_batter_statcast(df: pd.DataFrame) -> dict:
    if df.empty:
        return {}

    batted = df[df["bb_type"].notna()]
    hr_mask = df["events"] == "home_run"
    k_mask = df["events"] == "strikeout"
    bb_mask = df["events"] == "walk"

    pa_events = df["events"].notna()
    pa_count = pa_events.sum()

    ev = df["launch_speed"].dropna()
    la = df["launch_angle"].dropna()
    hard_hit = (df["launch_speed"] >= 95).sum() if len(ev) > 0 else 0
    barrel_mask = (
        (df["launch_speed"] >= 98) &
        (df["launch_angle"] >= 8) &
        (df["launch_angle"] <= 32)
    )

    xba = df["estimated_ba_using_speedangle"].dropna()
    xslg = df["estimated_slg_using_speedangle"].dropna() if "estimated_slg_using_speedangle" in df.columns else pd.Series(dtype=float)
    xwoba = df["estimated_woba_using_speedangle"].dropna() if "estimated_woba_using_speedangle" in df.columns else pd.Series(dtype=float)

    # Pull/Center/Oppo from hit_location (1-9 grid)
    in_play = batted[batted["hc_x"].notna() & batted["hc_y"].notna()]
    pull_count = 0
    cent_count = 0
    oppo_count = 0
    if not in_play.empty:
        # Rough zone split by batter stand
        for _, row in in_play.iterrows():
            x = row.get("hc_x", 125)
            stand = row.get("stand", "R")
            if stand == "R":
                if x < 100:
                    pull_count += 1
                elif x > 150:
                    oppo_count += 1
                else:
                    cent_count += 1
            else:
                if x > 150:
                    pull_count += 1
                elif x < 100:
                    oppo_count += 1
                else:
                    cent_count += 1

    in_play_count = len(in_play) or 1

    # Spray chart data (capped at 500 points for performance)
    spray_sample = batted[batted["hc_x"].notna()].head(500)
    spray = [
        {
            "hc_x": r["hc_x"],
            "hc_y": r["hc_y"],
            "bb_type": r.get("bb_type"),
            "events": r.get("events"),
            "launch_speed": r.get("launch_speed"),
            "launch_angle": r.get("launch_angle"),
        }
        for _, r in spray_sample.iterrows()
    ]

    return {
        "avg_ev": round(float(ev.mean()), 1) if len(ev) > 0 else None,
        "avg_la": round(float(la.mean()), 1) if len(la) > 0 else None,
        "max_ev": round(float(ev.max()), 1) if len(ev) > 0 else None,
        "hard_hit_pct": round(hard_hit / max(len(ev), 1) * 100, 1),
        "barrel_pct": round(barrel_mask.sum() / max(len(batted), 1) * 100, 1),
        "xba": round(float(xba.mean()), 3) if len(xba) > 0 else None,
        "xslg": round(float(xslg.mean()), 3) if len(xslg) > 0 else None,
        "xwoba": round(float(xwoba.mean()), 3) if len(xwoba) > 0 else None,
        "k_pct": round(k_mask.sum() / max(pa_count, 1) * 100, 1),
        "bb_pct": round(bb_mask.sum() / max(pa_count, 1) * 100, 1),
        "pull_pct": round(pull_count / in_play_count * 100, 1),
        "cent_pct": round(cent_count / in_play_count * 100, 1),
        "oppo_pct": round(oppo_count / in_play_count * 100, 1),
        "spray_chart": spray,
        "total_pitches": len(df),
    }


# ---------------------------------------------------------------------------
# Pitcher aggregations
# ---------------------------------------------------------------------------

def aggregate_pitcher_statcast(df: pd.DataFrame) -> dict:
    if df.empty:
        return {}

    pitch_types = {}
    for pt, grp in df.groupby("pitch_type"):
        if pd.isna(pt) or pt == "":
            continue
        velos = grp["release_speed"].dropna()
        spins = grp["release_spin_rate"].dropna()
        pfx_x = grp["pfx_x"].dropna() * 12  # convert ft to inches
        pfx_z = grp["pfx_z"].dropna() * 12
        whiffs = (grp["description"].str.contains("swinging_strike", na=False)).sum()
        total = len(grp)
        pitch_types[str(pt)] = {
            "pitch_type_code": str(pt),
            "usage_pct": round(total / max(len(df), 1) * 100, 1),
            "avg_speed": round(float(velos.mean()), 1) if len(velos) > 0 else None,
            "avg_spin_rate": round(float(spins.mean())) if len(spins) > 0 else None,
            "break_x": round(float(pfx_x.mean()), 2) if len(pfx_x) > 0 else None,
            "break_z": round(float(pfx_z.mean()), 2) if len(pfx_z) > 0 else None,
            "whiff_pct": round(whiffs / max(total, 1) * 100, 1),
            "count": total,
        }

    total_swings = df["description"].str.contains("swing", na=False).sum()
    total_csw = df["description"].str.contains("called_strike|swinging_strike", na=False).sum()

    return {
        "pitch_arsenal": list(pitch_types.values()),
        "total_pitches": len(df),
        "csw_pct": round(total_csw / max(len(df), 1) * 100, 1),
        "avg_fastball_velo": next(
            (v["avg_speed"] for v in pitch_types.values() if v["pitch_type_code"] in ("FF", "SI", "FC")),
            None,
        ),
    }


# ---------------------------------------------------------------------------
# Sprint speed (Baseball Savant CSV endpoint)
# ---------------------------------------------------------------------------

async def get_sprint_speed_leaderboard(season: int) -> list[dict]:
    key = f"sprint_speed_{season}"
    cached = cache.memory_get(key)
    if cached:
        return cached

    url = (
        f"https://baseballsavant.mlb.com/leaderboard/sprint_speed"
        f"?min_competitive=50&position=&team=&year={season}&_=1"
    )
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, params={"csv": "true"})
            resp.raise_for_status()
        from io import StringIO
        df = pd.read_csv(StringIO(resp.text))
        results = df.to_dict(orient="records")
        cache.memory_set(key, results)
        return results
    except Exception as exc:
        logger.warning(f"Sprint speed fetch failed: {exc}")
        return []
