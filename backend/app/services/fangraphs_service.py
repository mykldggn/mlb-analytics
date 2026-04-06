from __future__ import annotations

"""
FanGraphs data via pybaseball. Season stats, career stats, and Chadwick register
for MLBAM ↔ FanGraphs ID cross-referencing.
"""

import logging
from typing import Optional

import pandas as pd

from app.config import settings
from app.core import cache
from app.core.column_mapping import BATTING_COLUMN_MAP, PITCHING_COLUMN_MAP, normalize_df

logger = logging.getLogger(__name__)

_chadwick_cache: Optional[pd.DataFrame] = None


def _import_pybaseball():
    try:
        import pybaseball as pb
        pb.cache.enable()
        return pb
    except ImportError:
        raise RuntimeError("pybaseball is not installed. Run: pip install pybaseball")


# ---------------------------------------------------------------------------
# Chadwick Register — cross-reference FanGraphs IDs ↔ MLBAM IDs
# ---------------------------------------------------------------------------

def get_chadwick_register() -> pd.DataFrame:
    """Load the Chadwick Bureau player ID register (disk-cached, weekly refresh)."""
    global _chadwick_cache
    if _chadwick_cache is not None and not _chadwick_cache.empty:
        return _chadwick_cache

    key = "chadwick_register"
    cached = cache.disk_get_fresh(key, ttl_hours=24 * 7)
    if cached is not None:
        _chadwick_cache = cached
        return _chadwick_cache

    pb = _import_pybaseball()
    logger.info("Downloading Chadwick player ID register...")
    try:
        df = pb.chadwick_register()
        keep = ["key_mlbam", "key_fangraphs", "key_bbref", "key_retro", "name_first", "name_last"]
        df = df[[c for c in keep if c in df.columns]].dropna(subset=["key_fangraphs"])
        cache.disk_save(key, df)
        _chadwick_cache = df
        logger.info(f"Chadwick register loaded: {len(df)} players")
        return _chadwick_cache
    except Exception as exc:
        logger.warning(f"Chadwick register unavailable: {exc}")
        return pd.DataFrame(columns=["key_mlbam", "key_fangraphs"])


def build_fangraphs_to_mlbam_map() -> dict:
    """Return {fangraphs_id(int): mlbam_id(int)} from the Chadwick register."""
    df = get_chadwick_register()
    if df.empty or "key_mlbam" not in df.columns:
        return {}
    subset = df[["key_fangraphs", "key_mlbam"]].dropna()
    subset["key_fangraphs"] = pd.to_numeric(subset["key_fangraphs"], errors="coerce")
    subset["key_mlbam"] = pd.to_numeric(subset["key_mlbam"], errors="coerce")
    subset = subset.dropna().astype({"key_fangraphs": int, "key_mlbam": int})
    return dict(zip(subset["key_fangraphs"], subset["key_mlbam"]))


def build_mlbam_to_fangraphs_map() -> dict:
    """Return {mlbam_id(int): fangraphs_id(int)} from the Chadwick register."""
    return {v: k for k, v in build_fangraphs_to_mlbam_map().items()}


def _get_full_fg_mlb_map() -> dict:
    """Build {fangraphs_id(int): mlbam_id(int)} from ALL players (active + historical).
    Uses full Chadwick register as base, overlaid with the startup active-player map."""
    # Full Chadwick register covers every player ever (retired included)
    full = build_fangraphs_to_mlbam_map()
    # Overlay with active-player map built at startup (higher quality for current players)
    try:
        from app.core import player_id_map
        full.update(player_id_map._map_by_fg)
    except Exception:
        pass
    return full


def _build_name_to_mlbam_map() -> dict:
    """Build {normalized_fullname: mlbam_id} from Chadwick, for name-based fallback."""
    df = get_chadwick_register()
    if df.empty or "key_mlbam" not in df.columns:
        return {}
    needed = [c for c in ["name_first", "name_last", "key_mlbam"] if c in df.columns]
    if len(needed) < 3:
        return {}
    subset = df[needed].dropna()
    subset["key_mlbam"] = pd.to_numeric(subset["key_mlbam"], errors="coerce")
    subset = subset.dropna(subset=["key_mlbam"])
    subset["_key"] = (subset["name_first"].str.lower().str.strip() + " " + subset["name_last"].str.lower().str.strip())
    return dict(zip(subset["_key"], subset["key_mlbam"].astype(int)))


def _enrich_with_mlbam(df: pd.DataFrame) -> pd.DataFrame:
    """Add mlbam_id column using the full Chadwick + active-player map, with name fallback."""
    if "fangraphs_id" not in df.columns:
        return df

    # Check if already fully enriched (>= 80% match rate)
    if "mlbam_id" in df.columns:
        match_rate = df["mlbam_id"].notna().sum() / max(len(df), 1)
        if match_rate >= 0.80:
            return df  # already well-enriched

    try:
        fg_to_mlb = _get_full_fg_mlb_map()
        if not fg_to_mlb:
            logger.warning("MLBAM enrichment: empty Chadwick map, skipping")
            return df

        df = df.copy()

        def _lookup(fg_val):
            try:
                return fg_to_mlb.get(int(float(fg_val)))
            except (ValueError, TypeError):
                return None

        df["mlbam_id"] = df["fangraphs_id"].apply(_lookup)
        df["mlbam_id"] = pd.to_numeric(df["mlbam_id"], errors="coerce")
        matched = int(df["mlbam_id"].notna().sum())
        logger.info(f"MLBAM enrichment: {matched}/{len(df)} players matched")

        # Name-based fallback for players with key_fangraphs=-1 in Chadwick (e.g. recent debutants)
        null_mask = df["mlbam_id"].isna()
        if null_mask.any() and "name" in df.columns:
            try:
                name_map = _build_name_to_mlbam_map()
                if name_map:
                    def _name_lookup(nm):
                        if pd.isna(nm):
                            return None
                        return name_map.get(str(nm).lower().strip())
                    fallback = df.loc[null_mask, "name"].apply(_name_lookup)
                    fallback = pd.to_numeric(fallback, errors="coerce")
                    df.loc[null_mask, "mlbam_id"] = fallback
                    new_matched = int(df["mlbam_id"].notna().sum())
                    if new_matched > matched:
                        logger.info(f"MLBAM name-fallback: recovered {new_matched - matched} more players")
            except Exception as exc:
                logger.warning(f"MLBAM name-fallback failed: {exc}")
    except Exception as exc:
        logger.warning(f"MLBAM enrichment failed: {exc}")
    return df


# ---------------------------------------------------------------------------
# Batting — season stats
# ---------------------------------------------------------------------------

def _apply_name_fallback(df: pd.DataFrame) -> tuple:
    """Fill null mlbam_id rows using Chadwick name lookup.
    Returns (updated_df, changed: bool).
    """
    if "mlbam_id" not in df.columns or "name" not in df.columns:
        return df, False
    null_mask = df["mlbam_id"].isna()
    if not null_mask.any():
        return df, False
    try:
        name_map = _build_name_to_mlbam_map()
        if not name_map:
            return df, False
        def _lookup(nm):
            if pd.isna(nm):
                return None
            return name_map.get(str(nm).lower().strip())
        fallback = df.loc[null_mask, "name"].apply(_lookup)
        fallback = pd.to_numeric(fallback, errors="coerce")
        recovered = int(fallback.notna().sum())
        if recovered == 0:
            return df, False
        df = df.copy()
        df.loc[null_mask, "mlbam_id"] = fallback
        logger.info(f"Name fallback: recovered {recovered} mlbam_ids")
        return df, True
    except Exception as exc:
        logger.warning(f"Name fallback failed: {exc}")
        return df, False


def get_batting_stats(season: int, min_pa: int = 50) -> pd.DataFrame:
    """Return normalized + MLBAM-enriched FanGraphs batting stats for a season."""
    key = f"fg_batting_{season}_{min_pa}"
    df = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if df is not None:
        if "mlbam_id" not in df.columns:
            logger.info(f"Re-enriching batting cache (no mlbam_id): {season}")
            df = _enrich_with_mlbam(df)
            cache.disk_save(key, df)
        elif df["mlbam_id"].isna().any():
            # Apply name-based fallback for any null rows (e.g. recent debutants not yet in Chadwick map)
            df, changed = _apply_name_fallback(df)
            if changed:
                cache.disk_save(key, df)
        logger.info(f"Batting stats cache hit: {season}")
        return df

    pb = _import_pybaseball()
    logger.info(f"Fetching FanGraphs batting stats: {season}")
    raw = pb.batting_stats(season, season, qual=min_pa)
    df = normalize_df(raw, BATTING_COLUMN_MAP)
    df = _enrich_with_mlbam(df)
    cache.disk_save(key, df)
    return df


def get_batting_stats_range(start_dt: str, end_dt: str) -> pd.DataFrame:
    key = f"fg_batting_range_{start_dt}_{end_dt}"
    df = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if df is not None:
        return df
    pb = _import_pybaseball()
    raw = pb.batting_stats_range(start_dt, end_dt)
    df = normalize_df(raw, BATTING_COLUMN_MAP)
    df = _enrich_with_mlbam(df)
    cache.disk_save(key, df)
    return df


def _sanitize_record(record: dict) -> dict:
    """Replace NaN/Inf/pandas-NA values with None so they are JSON-serializable."""
    import math
    import pandas as pd
    out = {}
    for k, v in record.items():
        try:
            if pd.isna(v):
                out[k] = None
                continue
        except (TypeError, ValueError):
            pass
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            out[k] = None
        else:
            out[k] = v
    return out


def _find_player_in_df(df: pd.DataFrame, fangraphs_id: int) -> pd.DataFrame:
    """Return the player's row from a season DataFrame by FanGraphs ID."""
    if "fangraphs_id" not in df.columns:
        return pd.DataFrame()
    fg_col = pd.to_numeric(df["fangraphs_id"], errors="coerce")
    return df[fg_col == fangraphs_id]


def get_player_batting_by_season(
    fangraphs_id: int, start_season: int, end_season: int
) -> list:
    results = []
    for season in range(start_season, end_season + 1):
        try:
            # Try leaderboard-quality cache first (min_pa=50, warm from normal usage)
            # This avoids cold fetches for players with a full season of ABs
            row = pd.DataFrame()
            for min_pa in (50, 1):
                df = get_batting_stats(season, min_pa=min_pa)
                row = _find_player_in_df(df, fangraphs_id)
                if not row.empty:
                    break
            if not row.empty:
                record = _sanitize_record(row.iloc[0].to_dict())
                record["season"] = season
                results.append(record)
        except Exception as exc:
            logger.warning(f"No batting data for FG id {fangraphs_id} season {season}: {exc}")
    return results


# ---------------------------------------------------------------------------
# Batting — career stats
# ---------------------------------------------------------------------------

def get_career_batting_stats(fangraphs_id: int, debut_year: int) -> dict:
    """
    Career batting stats for a single player using per-season cached FanGraphs data.
    Returns year-by-year rows AND computed career-aggregate totals.
    """
    key = f"career_batting3_{fangraphs_id}_{debut_year}"
    cached = cache.disk_get_fresh(key, ttl_hours=24 * 7)
    if cached is not None:
        records = [_sanitize_record(r) for r in cached.to_dict(orient="records")]
        career_row = next((r for r in records if r.get("_type") == "career"), {})
        yby = [r for r in records if r.get("_type") == "season"]
        return {"year_by_year": yby, "career_totals": career_row}

    start = max(debut_year, 2002)
    end = settings.CURRENT_SEASON

    year_by_year = get_player_batting_by_season(fangraphs_id, start, end)

    # Compute career totals by summing counting stats
    career_totals: dict = {}
    if year_by_year:
        sum_keys = ["g", "ab", "pa", "h", "singles", "doubles", "triples", "hr",
                    "r", "rbi", "sb", "cs", "bb", "so", "war"]
        for k in sum_keys:
            vals = [r[k] for r in year_by_year if r.get(k) is not None]
            if vals:
                career_totals[k] = round(sum(vals), 1)
        # Carry name/team from last season
        last = year_by_year[-1]
        for k in ("name", "team"):
            if last.get(k) is not None:
                career_totals[k] = last[k]

    # Cache combined result
    combined_rows = [{"_type": "season", **r} for r in year_by_year]
    if career_totals:
        combined_rows.append({"_type": "career", **career_totals})
    if combined_rows:
        cache.disk_save(key, pd.DataFrame(combined_rows))

    return {"year_by_year": year_by_year, "career_totals": career_totals}


# ---------------------------------------------------------------------------
# Pitching — season stats
# ---------------------------------------------------------------------------

def get_pitching_stats(season: int, min_ip: int = 20) -> pd.DataFrame:
    key = f"fg_pitching_{season}_{min_ip}"
    df = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if df is not None:
        if "mlbam_id" not in df.columns:
            logger.info(f"Re-enriching pitching cache (no mlbam_id): {season}")
            df = _enrich_with_mlbam(df)
            cache.disk_save(key, df)
        elif df["mlbam_id"].isna().any():
            df, changed = _apply_name_fallback(df)
            if changed:
                cache.disk_save(key, df)
        logger.info(f"Pitching stats cache hit: {season}")
        return df

    pb = _import_pybaseball()
    logger.info(f"Fetching FanGraphs pitching stats: {season}")
    raw = pb.pitching_stats(season, season, qual=min_ip)
    df = normalize_df(raw, PITCHING_COLUMN_MAP)
    df = _enrich_with_mlbam(df)
    cache.disk_save(key, df)
    return df


def get_pitching_stats_range(start_dt: str, end_dt: str) -> pd.DataFrame:
    key = f"fg_pitching_range_{start_dt}_{end_dt}"
    df = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if df is not None:
        return df
    pb = _import_pybaseball()
    raw = pb.pitching_stats_range(start_dt, end_dt)
    df = normalize_df(raw, PITCHING_COLUMN_MAP)
    df = _enrich_with_mlbam(df)
    cache.disk_save(key, df)
    return df


def get_player_pitching_by_season(
    fangraphs_id: int, start_season: int, end_season: int
) -> list:
    results = []
    for season in range(start_season, end_season + 1):
        try:
            # Try leaderboard-quality cache first (min_ip=20, warm from normal usage)
            row = pd.DataFrame()
            for min_ip in (20, 1):
                df = get_pitching_stats(season, min_ip=min_ip)
                row = _find_player_in_df(df, fangraphs_id)
                if not row.empty:
                    break
            if not row.empty:
                record = _sanitize_record(row.iloc[0].to_dict())
                record["season"] = season
                results.append(record)
        except Exception as exc:
            logger.warning(f"No pitching data for FG id {fangraphs_id} season {season}: {exc}")
    return results


# ---------------------------------------------------------------------------
# Pitching — career stats
# ---------------------------------------------------------------------------

def get_career_pitching_stats(fangraphs_id: int, debut_year: int) -> dict:
    """
    Career pitching stats for a single player using per-season cached FanGraphs data.
    Returns year-by-year rows AND computed career-aggregate totals.
    """
    key = f"career_pitching3_{fangraphs_id}_{debut_year}"
    cached = cache.disk_get_fresh(key, ttl_hours=24 * 7)
    if cached is not None:
        records = [_sanitize_record(r) for r in cached.to_dict(orient="records")]
        career_row = next((r for r in records if r.get("_type") == "career"), {})
        yby = [r for r in records if r.get("_type") == "season"]
        return {"year_by_year": yby, "career_totals": career_row}

    start = max(debut_year, 2002)
    end = settings.CURRENT_SEASON

    year_by_year = get_player_pitching_by_season(fangraphs_id, start, end)

    # Compute career totals by summing counting stats
    career_totals: dict = {}
    if year_by_year:
        sum_keys = ["g", "gs", "w", "l", "sv", "hld", "h", "r", "er", "hr", "bb", "so", "war"]
        for k in sum_keys:
            vals = [r[k] for r in year_by_year if r.get(k) is not None]
            if vals:
                career_totals[k] = round(sum(vals), 1)
        ip_vals = [r["ip"] for r in year_by_year if r.get("ip") is not None]
        if ip_vals:
            career_totals["ip"] = round(sum(ip_vals), 1)
        last = year_by_year[-1]
        for k in ("name", "team"):
            if last.get(k) is not None:
                career_totals[k] = last[k]

    combined_rows = [{"_type": "season", **r} for r in year_by_year]
    if career_totals:
        combined_rows.append({"_type": "career", **career_totals})
    if combined_rows:
        cache.disk_save(key, pd.DataFrame(combined_rows))

    return {"year_by_year": year_by_year, "career_totals": career_totals}


# ---------------------------------------------------------------------------
# Team stats
# ---------------------------------------------------------------------------

def get_team_batting_stats(season: int) -> pd.DataFrame:
    key = f"team_batting_{season}"
    df = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if df is not None:
        return df
    pb = _import_pybaseball()
    logger.info(f"Fetching FanGraphs team batting stats: {season}")
    raw = pb.team_batting(season, season)
    cache.disk_save(key, raw)
    return raw


def get_team_pitching_stats(season: int) -> pd.DataFrame:
    key = f"team_pitching_{season}"
    df = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if df is not None:
        return df
    pb = _import_pybaseball()
    logger.info(f"Fetching FanGraphs team pitching stats: {season}")
    raw = pb.team_pitching(season, season)
    cache.disk_save(key, raw)
    return raw
