from __future__ import annotations

"""
Park Favorability Index (PFI) endpoints.

The PFI is our custom composite statistic that quantifies how much a ballpark
helps batters or pitchers relative to league-neutral conditions.

Scale: 0–200 where 100 = perfectly neutral
  Batter PFI > 100 → hitter-friendly
  Pitcher PFI > 100 → pitcher-friendly (= 200 - Batter PFI)

See app/core/stat_calculations.py for the full methodology.
"""

import asyncio
import logging
from fastapi import APIRouter, BackgroundTasks, Query
from typing import Optional

from app.config import settings
from app.core import cache
from app.core.stat_calculations import build_park_factors_from_statcast, compute_park_favorability
from app.services.statcast_service import get_season_statcast

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/park-factors", tags=["park-factors"])

# Static venue name map — covers multiple abbreviation variants used by
# different data sources (Statcast, FanGraphs, MLB Stats API).
VENUE_NAMES: dict[str, str] = {
    # Arizona Diamondbacks — FanGraphs uses "ARI", Statcast sometimes "AZ"
    "ARI": "Chase Field",
    "AZ":  "Chase Field",
    # Atlanta
    "ATL": "Truist Park",
    # Baltimore
    "BAL": "Oriole Park at Camden Yards",
    # Boston
    "BOS": "Fenway Park",
    # Chicago Cubs
    "CHC": "Wrigley Field",
    # Chicago White Sox — FanGraphs uses "CWS", MLB API uses "CWS"
    "CWS": "Guaranteed Rate Field",
    "CHW": "Guaranteed Rate Field",
    # Cincinnati
    "CIN": "Great American Ball Park",
    # Cleveland
    "CLE": "Progressive Field",
    "CLV": "Progressive Field",
    # Colorado
    "COL": "Coors Field",
    # Detroit
    "DET": "Comerica Park",
    # Houston
    "HOU": "Minute Maid Park",
    # Kansas City
    "KC":  "Kauffman Stadium",
    "KCR": "Kauffman Stadium",
    # LA Angels
    "LAA": "Angel Stadium",
    # LA Dodgers
    "LAD": "Dodger Stadium",
    # Miami
    "MIA": "loanDepot park",
    "FLA": "loanDepot park",
    # Milwaukee
    "MIL": "American Family Field",
    # Minnesota
    "MIN": "Target Field",
    # NY Mets
    "NYM": "Citi Field",
    # NY Yankees
    "NYY": "Yankee Stadium",
    # Athletics — Oakland Coliseum through 2024; Sutter Health Park (Sacramento) in 2025
    "OAK": "Oakland Coliseum",
    "ATH": "Sutter Health Park (Sacramento)",
    # Philadelphia
    "PHI": "Citizens Bank Park",
    # Pittsburgh
    "PIT": "PNC Park",
    # San Diego
    "SD":  "Petco Park",
    "SDP": "Petco Park",
    # Seattle
    "SEA": "T-Mobile Park",
    # San Francisco
    "SF":  "Oracle Park",
    "SFG": "Oracle Park",
    # St. Louis
    "STL": "Busch Stadium",
    # Tampa Bay
    "TB":  "Tropicana Field",
    "TBR": "Tropicana Field",
    "TBD": "Tropicana Field",
    # Texas
    "TEX": "Globe Life Field",
    # Toronto
    "TOR": "Rogers Centre",
    # Washington
    "WSH": "Nationals Park",
    "WSN": "Nationals Park",
}


def _pfi_interpretation(batter_pfi: float) -> str:
    if batter_pfi >= 130:
        return "Extreme hitter-friendly"
    elif batter_pfi >= 115:
        return "Hitter-friendly"
    elif batter_pfi >= 105:
        return "Slightly hitter-friendly"
    elif batter_pfi >= 95:
        return "Neutral"
    elif batter_pfi >= 85:
        return "Slightly pitcher-friendly"
    elif batter_pfi >= 70:
        return "Pitcher-friendly"
    else:
        return "Extreme pitcher-friendly"


@router.get("/{season}")
async def get_park_factors(
    season: int,
    background_tasks: BackgroundTasks,
):
    """
    Return Park Favorability Index for all 30 parks for a given season.
    Uses a 3-year rolling window (season-2 through season) for stability.
    First call triggers a background computation; subsequent calls hit cache.
    """
    cache_key = f"pfi_v2_{season}"
    cached = cache.memory_get(cache_key)
    if cached:
        return {"season": season, "seasons_used": cached["seasons_used"], "parks": cached["parks"]}

    disk_df = cache.disk_get_fresh(cache_key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS * 7)
    if disk_df is not None:
        records = disk_df.to_dict(orient="records")
        for r in records:
            r["park_name"] = VENUE_NAMES.get(r.get("team_abbr", ""), "Unknown")
            r["interpretation"] = _pfi_interpretation(r.get("batter_pfi", 100))
        result = {"seasons_used": list(range(max(season - 2, 2015), season + 1)), "parks": records}
        cache.memory_set(cache_key, result)
        return {"season": season, **result}

    # Not cached yet — trigger background computation
    background_tasks.add_task(_compute_and_cache_pfi, season, cache_key)  # cache_key already has v2
    return {
        "season": season,
        "status": "computing",
        "message": "Park factors are being computed. Poll this endpoint again in ~60 seconds.",
    }


@router.get("/{season}/team/{team_abbr}")
async def get_team_park_factor(season: int, team_abbr: str):
    """Return PFI detail for a single park."""
    cache_key = f"pfi_v2_{season}"
    cached = cache.memory_get(cache_key)
    if cached:
        parks = cached.get("parks", [])
        match = next((p for p in parks if p.get("team_abbr", "").upper() == team_abbr.upper()), None)
        if match:
            return match
    return {"team_abbr": team_abbr, "status": "not_computed", "message": f"Call /park-factors/{season} first"}


async def _compute_and_cache_pfi(season: int, cache_key: str):
    """Background task: pull multi-year Statcast and compute PFI."""
    import pandas as pd
    seasons_used = list(range(max(season - 2, 2015), season + 1))
    frames = []
    for s in seasons_used:
        try:
            df = get_season_statcast(f"{s}-03-20", f"{s}-11-01")
            if df is not None and not df.empty:
                frames.append(df)
        except Exception as exc:
            logger.warning(f"Could not fetch Statcast for {s}: {exc}")

    if not frames:
        logger.error("No Statcast data available for PFI computation")
        return

    combined = pd.concat(frames, ignore_index=True)
    try:
        result_df = build_park_factors_from_statcast(combined)
        result_df["park_name"] = result_df["team_abbr"].map(VENUE_NAMES).fillna("Unknown")
        result_df["interpretation"] = result_df["batter_pfi"].apply(_pfi_interpretation)
        cache.disk_save(cache_key, result_df)

        records = result_df.to_dict(orient="records")
        cache.memory_set(cache_key, {"seasons_used": seasons_used, "parks": records})
        logger.info(f"PFI computed for {season} using seasons {seasons_used}")
    except Exception as exc:
        logger.error(f"PFI computation failed: {exc}")
