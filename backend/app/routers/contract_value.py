from __future__ import annotations

"""
Contract Value endpoint.

Cross-references FanGraphs WAR with Lahman salary data to identify
the best and worst contracts in baseball history (data through ~2016).
For recent seasons, salary data availability may be limited.
"""

import logging
from fastapi import APIRouter, Query
from typing import Optional

from app.config import settings
from app.core import cache
from app.services import fangraphs_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contract-value", tags=["contract-value"])


_EXTENDED_SALARY_URL = (
    "https://raw.githubusercontent.com/cwhkami007/"
    "Lahmann-Baseball-Database-2025-2026-Salary-Updated-2024-/"
    "main/moneyballdatabase/Salaries.csv"
)


def _get_lahman_salaries() -> "pd.DataFrame":
    """Load salary database (1985–2024) — extended community dataset with Lahman-format fallback."""
    import pandas as pd
    key = "lahman_salaries_v2"
    cached = cache.disk_get_fresh(key, ttl_hours=24 * 30)  # static-ish data, refresh monthly
    if cached is not None:
        logger.info(f"Salary data from cache: {len(cached)} records, max year {cached['yearID'].max()}")
        return cached

    # Primary: community-maintained extended Lahman dataset (1985–2024)
    try:
        import httpx, io
        resp = httpx.get(_EXTENDED_SALARY_URL, timeout=20, follow_redirects=True)
        if resp.status_code == 200:
            df = pd.read_csv(io.StringIO(resp.text))
            if not df.empty and "yearID" in df.columns and "playerID" in df.columns:
                cache.disk_save(key, df)
                logger.info(f"Extended salary data loaded: {len(df)} records, max year {df['yearID'].max()}")
                return df
    except Exception as exc:
        logger.warning(f"Extended salary fetch failed: {exc}")

    # Fallback: lahman Python package (bundled, through 2016)
    try:
        import lahman
        df = lahman.salaries()
        if df is not None and not df.empty and "yearID" in df.columns:
            cache.disk_save(key, df)
            logger.info(f"Lahman package salaries loaded: {len(df)} records, max year {df['yearID'].max()}")
            return df
    except Exception as exc:
        logger.warning(f"lahman package failed: {exc}")

    return pd.DataFrame(columns=["playerID", "yearID", "salary"])


def _get_bbref_to_mlbam_map() -> dict:
    """Build {bbref_id: mlbam_id} map from Chadwick register."""
    import pandas as pd
    try:
        from app.services.fangraphs_service import get_chadwick_register
        df = get_chadwick_register()
        if df.empty or "key_bbref" not in df.columns or "key_mlbam" not in df.columns:
            return {}
        subset = df[["key_bbref", "key_mlbam"]].dropna()
        subset["key_mlbam"] = pd.to_numeric(subset["key_mlbam"], errors="coerce")
        subset = subset.dropna()
        subset["key_mlbam"] = subset["key_mlbam"].astype(int)
        return dict(zip(subset["key_bbref"].astype(str), subset["key_mlbam"]))
    except Exception as exc:
        logger.warning(f"BBRef→MLBAM map failed: {exc}")
        return {}


def _get_bbref_to_fangraphs_map() -> dict:
    """Build {bbref_id: fangraphs_id} map from Chadwick register.
    Lahman playerID matches key_bbref (Baseball Reference ID).
    """
    import pandas as pd
    try:
        from app.services.fangraphs_service import get_chadwick_register
        df = get_chadwick_register()
        if df.empty:
            return {}
        if "key_bbref" not in df.columns or "key_fangraphs" not in df.columns:
            logger.warning("Chadwick register missing key_bbref — forcing re-download")
            from app.services import fangraphs_service as fs
            fs._chadwick_cache = None
            df = get_chadwick_register()
            if "key_bbref" not in df.columns:
                return {}
        subset = df[["key_bbref", "key_fangraphs"]].dropna()
        subset["key_fangraphs"] = pd.to_numeric(subset["key_fangraphs"], errors="coerce")
        subset = subset.dropna()
        subset["key_fangraphs"] = subset["key_fangraphs"].astype(int)
        return dict(zip(subset["key_bbref"].astype(str), subset["key_fangraphs"]))
    except Exception as exc:
        logger.warning(f"BBRef→FG map failed: {exc}")
        return {}


def _get_mlbam_to_fangraphs_map() -> dict:
    """Build {mlbam_id: fangraphs_id} map."""
    from app.services.fangraphs_service import build_mlbam_to_fangraphs_map
    return build_mlbam_to_fangraphs_map()


@router.get("/{season}")
async def get_contract_value(
    season: int,
    min_pa: int = Query(default=100, description="Minimum PA for batters"),
    min_ip: float = Query(default=40, description="Minimum IP for pitchers"),
    group: str = Query(default="batting", description="batting | pitching"),
):
    """
    Return WAR per salary dollar rankings for a given season.
    Uses Lahman salary database (historical through ~2016) and FanGraphs WAR.
    """
    import pandas as pd
    from app.services.mlb_api_service import headshot_url

    # Check Lahman coverage
    salary_df = _get_lahman_salaries()
    if salary_df.empty:
        return {
            "season": season,
            "data_available": False,
            "message": "Salary data unavailable. pybaseball Lahman module required.",
            "players": [],
            "max_year": None,
        }

    max_year = int(salary_df["yearID"].max()) if not salary_df.empty else 0
    if season > max_year:
        return {
            "season": season,
            "data_available": False,
            "message": f"Salary data only available through {max_year}. Lahman database does not include {season}.",
            "players": [],
            "max_year": max_year,
        }

    # Filter salaries for this season
    season_salaries = salary_df[salary_df["yearID"] == season][["playerID", "salary"]].copy()
    if season_salaries.empty:
        return {
            "season": season,
            "data_available": False,
            "message": f"No salary data found for {season}.",
            "players": [],
            "max_year": max_year,
        }

    # Get WAR from FanGraphs
    try:
        if group == "batting":
            war_df = fangraphs_service.get_batting_stats(season, min_pa=min_pa)
        else:
            war_df = fangraphs_service.get_pitching_stats(season, min_ip=int(min_ip))
    except Exception as exc:
        return {
            "season": season,
            "data_available": False,
            "message": f"FanGraphs WAR data unavailable: {exc}",
            "players": [],
            "max_year": max_year,
        }

    if war_df.empty or "war" not in war_df.columns:
        return {
            "season": season,
            "data_available": False,
            "message": "WAR data not available for this season.",
            "players": [],
            "max_year": max_year,
        }

    # Build BBRef → MLBAM map via Chadwick (Lahman playerID = BBRef ID)
    bbref_to_mlbam = _get_bbref_to_mlbam_map()

    season_salaries = season_salaries.copy()
    season_salaries["mlbam_id"] = season_salaries["playerID"].astype(str).map(bbref_to_mlbam)
    season_salaries["mlbam_id"] = pd.to_numeric(season_salaries["mlbam_id"], errors="coerce")
    season_salaries = season_salaries.dropna(subset=["mlbam_id"])
    season_salaries["mlbam_id"] = season_salaries["mlbam_id"].astype(int)

    if season_salaries.empty:
        return {
            "season": season,
            "data_available": False,
            "message": "Could not cross-reference salary data with player IDs.",
            "players": [],
            "max_year": max_year,
        }

    # Merge on mlbam_id
    war_df["mlbam_id"] = pd.to_numeric(war_df["mlbam_id"], errors="coerce")
    war_df = war_df.dropna(subset=["mlbam_id"])
    war_df["mlbam_id"] = war_df["mlbam_id"].astype(int)
    merged = pd.merge(season_salaries, war_df, on="mlbam_id", how="inner")

    if merged.empty:
        return {
            "season": season,
            "data_available": False,
            "message": "No players matched between salary and WAR data.",
            "players": [],
            "max_year": max_year,
        }

    # Compute $/WAR
    merged = merged.copy()
    merged["salary"] = pd.to_numeric(merged["salary"], errors="coerce")
    merged["war"] = pd.to_numeric(merged["war"], errors="coerce")
    merged = merged.dropna(subset=["salary", "war"])
    merged = merged[merged["salary"] > 0]

    merged["dollars_per_war"] = merged.apply(
        lambda r: round(r["salary"] / r["war"], 0) if r["war"] > 0.5 else None,
        axis=1,
    )
    merged["war_per_million"] = merged.apply(
        lambda r: round(r["war"] / (r["salary"] / 1_000_000), 2) if r["salary"] > 0 and r["war"] > 0 else None,
        axis=1,
    )

    players = []
    for _, row in merged.iterrows():
        mlbam = row.get("mlbam_id")
        mlbam_int = int(mlbam) if mlbam and mlbam == mlbam else None
        players.append({
            "name": row.get("name", ""),
            "team": row.get("team", ""),
            "mlbam_id": mlbam_int,
            "salary": int(row["salary"]),
            "war": round(float(row["war"]), 1),
            "dollars_per_war": int(row["dollars_per_war"]) if (row.get("dollars_per_war") is not None and row["dollars_per_war"] == row["dollars_per_war"]) else None,
            "war_per_million": float(row["war_per_million"]) if (row.get("war_per_million") is not None and row["war_per_million"] == row["war_per_million"]) else None,
            "headshot_url": headshot_url(mlbam_int) if mlbam_int else None,
        })

    # Sort by best value: highest WAR-per-dollar for positive WAR
    best_value = sorted(
        [p for p in players if p["war_per_million"] is not None and p["war"] > 0],
        key=lambda p: p["war_per_million"],  # type: ignore[return-value]
        reverse=True,
    )[:30]
    worst_value = sorted(
        [p for p in players if p["dollars_per_war"] is not None],
        key=lambda p: p["dollars_per_war"],  # type: ignore[return-value]
        reverse=True,
    )[:30]

    return {
        "season": season,
        "data_available": True,
        "max_year": max_year,
        "total_players": len(players),
        "best_value": best_value,
        "worst_value": worst_value,
    }
