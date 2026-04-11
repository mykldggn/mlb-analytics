from __future__ import annotations

"""
MLB Stats Service — replaces FanGraphs for season/career/team stats.

Sources:
  - MLB Stats API (statsapi.mlb.com): traditional stats — no IP restrictions
  - Baseball Reference static CSVs: bWAR — publicly accessible from any IP
  - Baseball Savant leaderboard CSVs: xBA, xSLG, xwOBA, barrel%, hard_hit%, avg EV
  - Computed locally: ISO, BABIP, FIP, K%, BB%, wOBA, wRC+, K/9, BB/9, LOB%, ERA-, FIP-
  - Per-player Statcast (existing): GB%, FB%, LD%, SwStr%, CSW%, Zone%, O-Swing%
"""

import io
import logging
import math
from typing import Optional

import httpx
import numpy as np
import pandas as pd

from app.config import settings
from app.core import cache

logger = logging.getLogger(__name__)

MLB_API_BASE = "https://statsapi.mlb.com/api/v1"
BREF_BAT_URL = "https://www.baseball-reference.com/data/war_daily_bat.txt"
BREF_PITCH_URL = "https://www.baseball-reference.com/data/war_daily_pitch.txt"

# wOBA linear weights by season (from FanGraphs Guts page).
# The weights change slightly each year; add new seasons as needed.
_WOBA_WEIGHTS: dict[int | str, dict] = {
    2025: {"bb": 0.693, "hbp": 0.723, "single": 0.877, "double": 1.232, "triple": 1.552, "hr": 1.980, "scale": 1.21},
    2024: {"bb": 0.693, "hbp": 0.720, "single": 0.876, "double": 1.231, "triple": 1.549, "hr": 1.978, "scale": 1.21},
    2023: {"bb": 0.696, "hbp": 0.726, "single": 0.883, "double": 1.244, "triple": 1.569, "hr": 2.004, "scale": 1.22},
    2022: {"bb": 0.689, "hbp": 0.720, "single": 0.881, "double": 1.242, "triple": 1.565, "hr": 2.004, "scale": 1.21},
    2021: {"bb": 0.688, "hbp": 0.718, "single": 0.878, "double": 1.242, "triple": 1.558, "hr": 2.002, "scale": 1.21},
    2019: {"bb": 0.690, "hbp": 0.719, "single": 0.870, "double": 1.217, "triple": 1.529, "hr": 1.940, "scale": 1.16},
    2018: {"bb": 0.690, "hbp": 0.720, "single": 0.880, "double": 1.247, "triple": 1.578, "hr": 2.031, "scale": 1.26},
    "default": {"bb": 0.690, "hbp": 0.720, "single": 0.880, "double": 1.230, "triple": 1.550, "hr": 1.970, "scale": 1.21},
}

FIP_CONSTANT = 3.10  # approximate league-average FIP constant (varies ±0.10 year to year)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _w(season: int) -> dict:
    return _WOBA_WEIGHTS.get(season, _WOBA_WEIGHTS["default"])


def _pf(val) -> Optional[float]:
    """Parse a value to float, returning None on failure."""
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (ValueError, TypeError):
        return None


def _sanitize(record: dict) -> dict:
    """Replace NaN/Inf values with None for JSON safety."""
    out = {}
    for k, v in record.items():
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            out[k] = None
        else:
            out[k] = v
    return out


def _ip_to_decimal(ip_str) -> float:
    """Convert '120.2' (MLB API innings pitched format) to 120.667 decimal."""
    try:
        s = str(ip_str)
        parts = s.split(".")
        if len(parts) == 2:
            return int(parts[0]) + int(parts[1]) / 3.0
        return float(s)
    except (ValueError, TypeError):
        return 0.0


# ---------------------------------------------------------------------------
# Baseball Reference WAR
# ---------------------------------------------------------------------------

def _load_bref_bat_full() -> pd.DataFrame:
    """Download and cache the full bRef batting WAR file (refreshed every 3 days)."""
    key = "bref_war_bat_full"
    df = cache.disk_get_fresh(key, ttl_hours=72)
    if df is not None:
        return df
    logger.info("Downloading Baseball Reference batting WAR file...")
    try:
        resp = httpx.get(BREF_BAT_URL, timeout=60,
                         headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), low_memory=False)
        cache.disk_save(key, df)
        logger.info(f"bRef batting WAR loaded: {len(df)} rows")
        return df
    except Exception as exc:
        logger.warning(f"bRef batting WAR fetch failed: {exc}")
        return pd.DataFrame()


def _load_bref_pitch_full() -> pd.DataFrame:
    """Download and cache the full bRef pitching WAR file (refreshed every 3 days)."""
    key = "bref_war_pitch_full"
    df = cache.disk_get_fresh(key, ttl_hours=72)
    if df is not None:
        return df
    logger.info("Downloading Baseball Reference pitching WAR file...")
    try:
        resp = httpx.get(BREF_PITCH_URL, timeout=60,
                         headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), low_memory=False)
        cache.disk_save(key, df)
        logger.info(f"bRef pitching WAR loaded: {len(df)} rows")
        return df
    except Exception as exc:
        logger.warning(f"bRef pitching WAR fetch failed: {exc}")
        return pd.DataFrame()


def _bref_war_bat_season(season: int) -> pd.DataFrame:
    """Return bRef batter WAR summed per MLBAM ID for one season."""
    df = _load_bref_bat_full()
    if df.empty or "year_ID" not in df.columns:
        return pd.DataFrame()
    df = df[df["year_ID"] == season].copy()
    df["mlb_ID"] = pd.to_numeric(df["mlb_ID"], errors="coerce")
    df["WAR"] = pd.to_numeric(df["WAR"], errors="coerce")
    df = df.dropna(subset=["mlb_ID", "WAR"])
    grouped = df.groupby("mlb_ID").agg(war=("WAR", "sum")).reset_index()
    grouped = grouped.rename(columns={"mlb_ID": "mlbam_id"})
    grouped["mlbam_id"] = grouped["mlbam_id"].astype(int)
    return grouped


def _bref_war_pitch_season(season: int) -> pd.DataFrame:
    """Return bRef pitcher WAR summed per MLBAM ID for one season."""
    df = _load_bref_pitch_full()
    if df.empty or "year_ID" not in df.columns:
        return pd.DataFrame()
    df = df[df["year_ID"] == season].copy()
    df["mlb_ID"] = pd.to_numeric(df["mlb_ID"], errors="coerce")
    df["WAR"] = pd.to_numeric(df["WAR"], errors="coerce")
    df = df.dropna(subset=["mlb_ID", "WAR"])
    grouped = df.groupby("mlb_ID").agg(war=("WAR", "sum")).reset_index()
    grouped = grouped.rename(columns={"mlb_ID": "mlbam_id"})
    grouped["mlbam_id"] = grouped["mlbam_id"].astype(int)
    return grouped


def _bref_war_bat_player(mlbam_id: int) -> dict[int, float]:
    """Return {season: war} dict for a single batter across all seasons."""
    df = _load_bref_bat_full()
    if df.empty:
        return {}
    df["mlb_ID"] = pd.to_numeric(df["mlb_ID"], errors="coerce")
    df["WAR"] = pd.to_numeric(df["WAR"], errors="coerce")
    player = df[df["mlb_ID"] == mlbam_id].dropna(subset=["WAR"])
    if player.empty:
        return {}
    return player.groupby("year_ID")["WAR"].sum().to_dict()


def _bref_war_pitch_player(mlbam_id: int) -> dict[int, float]:
    """Return {season: war} dict for a single pitcher across all seasons."""
    df = _load_bref_pitch_full()
    if df.empty:
        return {}
    df["mlb_ID"] = pd.to_numeric(df["mlb_ID"], errors="coerce")
    df["WAR"] = pd.to_numeric(df["WAR"], errors="coerce")
    player = df[df["mlb_ID"] == mlbam_id].dropna(subset=["WAR"])
    if player.empty:
        return {}
    return player.groupby("year_ID")["WAR"].sum().to_dict()


# ---------------------------------------------------------------------------
# Baseball Savant expected stats leaderboard
# ---------------------------------------------------------------------------

def _savant_expected_stats(season: int, stat_type: str = "batter") -> pd.DataFrame:
    """
    Fetch Baseball Savant expected stats CSV leaderboard.
    stat_type: 'batter' or 'pitcher'
    Returns DataFrame with mlbam_id + xba, xslg, xwoba, barrel_pct, hard_hit_pct, avg_ev, avg_la
    """
    key = f"savant_expected_{stat_type}_{season}"
    cached = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if cached is not None:
        return cached

    url = (
        f"https://baseballsavant.mlb.com/leaderboard/expected_statistics"
        f"?type={stat_type}&year={season}&position=&team=&min=1&csv=true"
    )
    try:
        resp = httpx.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text))
        if df.empty:
            return pd.DataFrame()

        # Map Savant column names (they vary slightly) → our standard names
        col_map: dict[str, str] = {}
        for col in df.columns:
            cl = col.lower().strip()
            if cl in ("player_id", "mlbam_id", "batter", "pitcher"):
                col_map[col] = "mlbam_id"
            elif cl in ("est_ba", "xba", "expected_ba"):
                col_map[col] = "xba"
            elif cl in ("est_slg", "xslg", "expected_slg"):
                col_map[col] = "xslg"
            elif cl in ("est_woba", "xwoba", "expected_woba"):
                col_map[col] = "xwoba"
            elif cl in ("est_obp", "xobp", "expected_obp"):
                col_map[col] = "xobp"
            elif "barrel" in cl:  # barrel_batted_rate, barrel_rate, barrel_pct, etc.
                col_map[col] = "barrel_pct"
            elif "hard_hit" in cl and "percent" in cl:
                col_map[col] = "hard_hit_pct"
            elif cl in ("avg_hit_speed", "avg_hit_speed_swing", "launch_speed"):
                col_map[col] = "avg_ev"
            elif cl in ("avg_hit_angle", "launch_angle"):
                col_map[col] = "avg_la"

        df = df.rename(columns=col_map)
        keep = [c for c in ("mlbam_id", "xba", "xslg", "xwoba", "xobp",
                             "barrel_pct", "hard_hit_pct", "avg_ev", "avg_la")
                if c in df.columns]
        if "mlbam_id" not in keep:
            logger.warning(f"Savant expected stats: no player_id column found ({stat_type} {season})")
            return pd.DataFrame()

        df = df[keep].copy()
        df["mlbam_id"] = pd.to_numeric(df["mlbam_id"], errors="coerce")
        df = df.dropna(subset=["mlbam_id"])
        df["mlbam_id"] = df["mlbam_id"].astype(int)
        cache.disk_save(key, df)
        logger.info(f"Savant expected stats ({stat_type} {season}): {len(df)} players")
        return df
    except Exception as exc:
        logger.warning(f"Savant expected stats fetch failed ({stat_type} {season}): {exc}")
        return pd.DataFrame()


# ---------------------------------------------------------------------------
# MLB Stats API — batting season
# ---------------------------------------------------------------------------

def _mlb_batting_season(season: int) -> pd.DataFrame:
    """Pull all batter season stats from MLB Stats API (paginated)."""
    rows: list[dict] = []
    offset = 0
    limit = 500

    while True:
        try:
            resp = httpx.get(
                f"{MLB_API_BASE}/stats",
                params={
                    "stats": "season",
                    "group": "hitting",
                    "season": season,
                    "gameType": "R",
                    "playerPool": "All",
                    "limit": limit,
                    "offset": offset,
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.warning(f"MLB API batting fetch failed (offset={offset}): {exc}")
            break

        splits: list[dict] = []
        for sg in data.get("stats", []):
            splits.extend(sg.get("splits", []))
        if not splits:
            break

        for split in splits:
            player = split.get("player", {})
            team = split.get("team", {})
            stat = split.get("stat", {})
            mlbam_id = player.get("id")
            if not mlbam_id:
                continue

            h   = int(stat.get("hits", 0) or 0)
            ab  = int(stat.get("atBats", 0) or 0)
            pa  = int(stat.get("plateAppearances", 0) or 0)
            hr  = int(stat.get("homeRuns", 0) or 0)
            bb  = int(stat.get("baseOnBalls", 0) or 0)
            ibb = int(stat.get("intentionalWalks", 0) or 0)
            hbp = int(stat.get("hitByPitch", 0) or 0)
            so  = int(stat.get("strikeOuts", 0) or 0)
            sf  = int(stat.get("sacFlies", 0) or 0)
            sh  = int(stat.get("sacBunts", 0) or 0)
            dbl = int(stat.get("doubles", 0) or 0)
            tpl = int(stat.get("triples", 0) or 0)
            singles = h - dbl - tpl - hr

            rows.append({
                "mlbam_id": int(mlbam_id),
                "name":     player.get("fullName", ""),
                "team":     team.get("abbreviation", ""),
                "g":   int(stat.get("gamesPlayed", 0) or 0),
                "ab":  ab,
                "pa":  pa,
                "h":   h,
                "singles": singles,
                "doubles": dbl,
                "triples": tpl,
                "hr":  hr,
                "r":   int(stat.get("runs", 0) or 0),
                "rbi": int(stat.get("rbi", 0) or 0),
                "sb":  int(stat.get("stolenBases", 0) or 0),
                "cs":  int(stat.get("caughtStealing", 0) or 0),
                "bb":  bb,
                "ibb": ibb,
                "hbp": hbp,
                "so":  so,
                "sf":  sf,
                "sh":  sh,
                "avg":  _pf(stat.get("avg")),
                "obp":  _pf(stat.get("obp")),
                "slg":  _pf(stat.get("slg")),
                "ops":  _pf(stat.get("ops")),
                "babip": _pf(stat.get("babip")),
            })

        if len(splits) < limit:
            break
        offset += limit

    return pd.DataFrame(rows) if rows else pd.DataFrame()


def _compute_batting_derived(df: pd.DataFrame, season: int) -> pd.DataFrame:
    """Add ISO, K%, BB%, wOBA, wRC+, wRAA to a batting DataFrame."""
    w = _w(season)
    df = df.copy()

    pa  = df["pa"].replace(0, np.nan)
    so  = df["so"].astype(float)
    bb  = df["bb"].astype(float)
    ibb = df["ibb"].astype(float)
    hbp = df["hbp"].astype(float)
    sf  = df["sf"].astype(float)
    ab  = df["ab"].astype(float)
    slg = df["slg"].astype(float)
    avg = df["avg"].astype(float)

    df["iso"]       = (slg - avg).round(3)
    df["k_pct"]     = (so / pa).round(4)
    df["bb_pct"]    = (bb / pa).round(4)
    df["bb_k_ratio"] = (bb / so.replace(0, np.nan)).round(3)

    ubb = bb - ibb
    woba_num = (
        w["bb"]     * ubb
        + w["hbp"]    * hbp
        + w["single"] * df["singles"].astype(float)
        + w["double"] * df["doubles"].astype(float)
        + w["triple"] * df["triples"].astype(float)
        + w["hr"]     * df["hr"].astype(float)
    )
    woba_denom = ab + ubb + hbp + sf
    df["woba"] = (woba_num / woba_denom.replace(0, np.nan)).round(3)

    # wRC+: use median wOBA as a robust league-average proxy
    lg_woba = df["woba"].median()
    if lg_woba and lg_woba > 0:
        df["wrc_plus"] = ((df["woba"] / lg_woba) * 100).round(1)
        df["wraa"]     = (((df["woba"] - lg_woba) / w["scale"]) * pa).round(1)
    else:
        df["wrc_plus"] = np.nan
        df["wraa"]     = np.nan

    return df


# ---------------------------------------------------------------------------
# MLB Stats API — pitching season
# ---------------------------------------------------------------------------

def _mlb_pitching_season(season: int) -> pd.DataFrame:
    """Pull all pitcher season stats from MLB Stats API (paginated)."""
    rows: list[dict] = []
    offset = 0
    limit = 500

    while True:
        try:
            resp = httpx.get(
                f"{MLB_API_BASE}/stats",
                params={
                    "stats": "season",
                    "group": "pitching",
                    "season": season,
                    "gameType": "R",
                    "playerPool": "All",
                    "limit": limit,
                    "offset": offset,
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.warning(f"MLB API pitching fetch failed (offset={offset}): {exc}")
            break

        splits: list[dict] = []
        for sg in data.get("stats", []):
            splits.extend(sg.get("splits", []))
        if not splits:
            break

        for split in splits:
            player = split.get("player", {})
            team   = split.get("team", {})
            stat   = split.get("stat", {})
            mlbam_id = player.get("id")
            if not mlbam_id:
                continue

            ip  = _ip_to_decimal(stat.get("inningsPitched", "0"))
            bb  = int(stat.get("baseOnBalls", 0) or 0)
            ibb = int(stat.get("intentionalWalks", 0) or 0)
            hbp = int(stat.get("hitByPitch", 0) or 0)
            so  = int(stat.get("strikeOuts", 0) or 0)
            hr  = int(stat.get("homeRuns", 0) or 0)
            h   = int(stat.get("hits", 0) or 0)
            er  = int(stat.get("earnedRuns", 0) or 0)
            r   = int(stat.get("runs", 0) or 0)
            bf  = int(stat.get("battersFaced", 0) or 0)
            sf  = int(stat.get("sacFlies", 0) or 0)

            rows.append({
                "mlbam_id": int(mlbam_id),
                "name":  player.get("fullName", ""),
                "team":  team.get("abbreviation", ""),
                "g":     int(stat.get("gamesPlayed", 0) or 0),
                "gs":    int(stat.get("gamesStarted", 0) or 0),
                "w":     int(stat.get("wins", 0) or 0),
                "l":     int(stat.get("losses", 0) or 0),
                "sv":    int(stat.get("saves", 0) or 0),
                "hld":   int(stat.get("holds", 0) or 0),
                "bs":    int(stat.get("blownSaves", 0) or 0),
                "ip":    round(ip, 1),
                "h":     h,
                "r":     r,
                "er":    er,
                "hr":    hr,
                "bb":    bb,
                "ibb":   ibb,
                "hbp":   hbp,
                "so":    so,
                "bf":    bf,
                "sf":    sf,
                "era":   _pf(stat.get("era")),
                "whip":  _pf(stat.get("whip")),
                "avg_against": _pf(stat.get("avg")),
                "babip": _pf(stat.get("babip")),
            })

        if len(splits) < limit:
            break
        offset += limit

    return pd.DataFrame(rows) if rows else pd.DataFrame()


def _compute_pitching_derived(df: pd.DataFrame) -> pd.DataFrame:
    """Add FIP, K/9, BB/9, LOB%, ERA-, FIP- and other derived pitching stats."""
    df = df.copy()
    ip = df["ip"].astype(float).replace(0, np.nan)
    bf = df["bf"].astype(float).replace(0, np.nan)
    so = df["so"].astype(float)
    bb = df["bb"].astype(float)
    ibb = df["ibb"].astype(float)
    hbp = df["hbp"].astype(float)
    hr  = df["hr"].astype(float)
    h   = df["h"].astype(float)
    r   = df["r"].astype(float)

    df["k_per_9"]      = (so * 9 / ip).round(2)
    df["bb_per_9"]     = (bb * 9 / ip).round(2)
    df["hr_per_9"]     = (hr * 9 / ip).round(2)
    df["h_per_9"]      = (h  * 9 / ip).round(2)
    df["k_bb_ratio"]   = (so / bb.replace(0, np.nan)).round(2)
    df["k_pct"]        = (so / bf).round(4)
    df["bb_pct"]       = (bb / bf).round(4)
    df["k_minus_bb_pct"] = (df["k_pct"] - df["bb_pct"]).round(4)

    ubb = bb - ibb
    fip_num = 13 * hr + 3 * (ubb + hbp) - 2 * so
    df["fip"] = (fip_num / ip + FIP_CONSTANT).round(2)

    lob_num   = h + bb + hbp - r
    lob_denom = h + bb + hbp - 1.4 * hr
    df["lob_pct"] = (lob_num / lob_denom.replace(0, np.nan)).clip(0, 1).round(3)

    lg_era = df["era"].dropna().median()
    lg_fip = df["fip"].dropna().median()
    if lg_era and lg_era > 0:
        df["era_minus"] = (100 * df["era"] / lg_era).round(1)
    if lg_fip and lg_fip > 0:
        df["fip_minus"] = (100 * df["fip"] / lg_fip).round(1)

    # Compute pitcher BABIP = (H - HR) / (BF - BB - SO - HR - HBP)
    # MLB API often omits this field; derive it from counting stats.
    babip_denom = df["bf"].astype(float) - bb - so - hr - hbp
    babip_denom = babip_denom.where(babip_denom > 0, other=np.nan)
    computed_babip = ((h - hr) / babip_denom).round(3)
    if "babip" in df.columns:
        df["babip"] = df["babip"].fillna(computed_babip)
    else:
        df["babip"] = computed_babip

    return df


# ---------------------------------------------------------------------------
# Public API: season stats
# ---------------------------------------------------------------------------

def get_batting_stats(season: int, min_pa: int = 50) -> pd.DataFrame:
    """
    Season batting stats combining MLB API + bRef WAR + Savant xStats + computed metrics.
    Mirrors the old fangraphs_service.get_batting_stats() signature exactly.
    """
    full_key = f"mlb_batting_full_{season}"
    df = cache.disk_get_fresh(full_key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)

    if df is None:
        logger.info(f"Building batting stats for {season}...")
        df = _mlb_batting_season(season)
        if df.empty:
            logger.warning(f"MLB API returned no batting data for {season}")
            return pd.DataFrame()

        df = _compute_batting_derived(df, season)

        # Merge bRef WAR
        war_df = _bref_war_bat_season(season)
        if not war_df.empty:
            df = df.merge(war_df, on="mlbam_id", how="left")
            matched = int(df["war"].notna().sum())
            logger.info(f"bRef WAR merged (batting {season}): {matched}/{len(df)} players")
        else:
            df["war"] = np.nan

        # Merge Savant expected stats
        savant_df = _savant_expected_stats(season, "batter")
        if not savant_df.empty:
            df = df.merge(savant_df, on="mlbam_id", how="left")
            matched = int(df.get("xba", pd.Series(dtype=float)).notna().sum())
            logger.info(f"Savant xStats merged (batting {season}): {matched}/{len(df)} players")

        cache.disk_save(full_key, df)
        logger.info(f"Batting stats built: {len(df)} players for {season}")

    # If barrel_pct is missing from a stale cache, merge Savant data now and re-save.
    if "barrel_pct" not in df.columns:
        savant_df = _savant_expected_stats(season, "batter")
        if not savant_df.empty:
            savant_cols = ["mlbam_id"] + [c for c in savant_df.columns if c != "mlbam_id"]
            df = df.merge(savant_df[savant_cols], on="mlbam_id", how="left")
            try:
                cache.disk_save(full_key, df)
                logger.info(f"Patched batting cache with Savant stats for {season}")
            except Exception as exc:
                logger.warning(f"Could not update batting cache: {exc}")

    if min_pa > 0 and "pa" in df.columns:
        df = df[df["pa"] >= min_pa].copy()

    return df


def get_pitching_stats(season: int, min_ip: int = 20) -> pd.DataFrame:
    """
    Season pitching stats combining MLB API + bRef WAR + Savant xStats + computed metrics.
    Mirrors the old fangraphs_service.get_pitching_stats() signature exactly.
    """
    full_key = f"mlb_pitching_full_{season}"
    df = cache.disk_get_fresh(full_key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)

    if df is None:
        logger.info(f"Building pitching stats for {season}...")
        df = _mlb_pitching_season(season)
        if df.empty:
            logger.warning(f"MLB API returned no pitching data for {season}")
            return pd.DataFrame()

        df = _compute_pitching_derived(df)

        # Merge bRef WAR
        war_df = _bref_war_pitch_season(season)
        if not war_df.empty:
            df = df.merge(war_df, on="mlbam_id", how="left")
            matched = int(df["war"].notna().sum())
            logger.info(f"bRef WAR merged (pitching {season}): {matched}/{len(df)} players")
        else:
            df["war"] = np.nan

        # Merge Savant expected stats (pitcher side)
        savant_df = _savant_expected_stats(season, "pitcher")
        if not savant_df.empty:
            df = df.merge(savant_df, on="mlbam_id", how="left")

        cache.disk_save(full_key, df)
        logger.info(f"Pitching stats built: {len(df)} players for {season}")

    if min_ip > 0 and "ip" in df.columns:
        df = df[df["ip"] >= min_ip].copy()

    return df


# ---------------------------------------------------------------------------
# Career stats via MLB API yearByYear endpoint
# ---------------------------------------------------------------------------

def get_career_batting_stats(mlbam_id: int) -> dict:
    """
    Year-by-year + career totals for a batter, using MLB Stats API + bRef WAR.
    Takes mlbam_id directly — no FanGraphs ID required.
    """
    cache_key = f"career_bat_mlb_{mlbam_id}"
    cached = cache.disk_get_fresh(cache_key, ttl_hours=24 * 7)
    if cached is not None:
        records = [_sanitize(r) for r in cached.to_dict(orient="records")]
        career_row = next((r for r in records if r.get("_type") == "career"), {})
        yby = [r for r in records if r.get("_type") == "season"]
        return {"year_by_year": yby, "career_totals": career_row}

    try:
        resp = httpx.get(
            f"{MLB_API_BASE}/people/{mlbam_id}/stats",
            params={"stats": "yearByYear", "group": "hitting", "gameType": "R"},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning(f"Career batting fetch failed for {mlbam_id}: {exc}")
        return {"year_by_year": [], "career_totals": {}}

    war_by_season = _bref_war_bat_player(mlbam_id)

    rows: list[dict] = []
    for sg in data.get("stats", []):
        for split in sg.get("splits", []):
            season_str = split.get("season", "")
            try:
                season_int = int(season_str)
            except (ValueError, TypeError):
                continue
            if season_int < 1980:
                continue

            stat = split.get("stat", {})
            team = split.get("team", {}).get("abbreviation", "")

            h   = int(stat.get("hits", 0) or 0)
            ab  = int(stat.get("atBats", 0) or 0)
            pa  = int(stat.get("plateAppearances", 0) or 0)
            hr  = int(stat.get("homeRuns", 0) or 0)
            bb  = int(stat.get("baseOnBalls", 0) or 0)
            ibb = int(stat.get("intentionalWalks", 0) or 0)
            hbp = int(stat.get("hitByPitch", 0) or 0)
            so  = int(stat.get("strikeOuts", 0) or 0)
            sf  = int(stat.get("sacFlies", 0) or 0)
            dbl = int(stat.get("doubles", 0) or 0)
            tpl = int(stat.get("triples", 0) or 0)
            singles = h - dbl - tpl - hr
            slg = _pf(stat.get("slg"))
            avg = _pf(stat.get("avg"))

            w = _w(season_int)
            ubb = bb - ibb
            woba_denom = ab + ubb + hbp + sf
            woba = None
            if woba_denom > 0:
                woba = round(
                    (w["bb"] * ubb + w["hbp"] * hbp + w["single"] * singles
                     + w["double"] * dbl + w["triple"] * tpl + w["hr"] * hr)
                    / woba_denom, 3
                )

            rows.append(_sanitize({
                "season":  season_int,
                "team":    team,
                "g":       int(stat.get("gamesPlayed", 0) or 0),
                "ab":      ab,
                "pa":      pa,
                "h":       h,
                "singles": singles,
                "doubles": dbl,
                "triples": tpl,
                "hr":      hr,
                "r":       int(stat.get("runs", 0) or 0),
                "rbi":     int(stat.get("rbi", 0) or 0),
                "sb":      int(stat.get("stolenBases", 0) or 0),
                "cs":      int(stat.get("caughtStealing", 0) or 0),
                "bb":      bb,
                "ibb":     ibb,
                "so":      so,
                "hbp":     hbp,
                "sf":      sf,
                "avg":     avg,
                "obp":     _pf(stat.get("obp")),
                "slg":     slg,
                "ops":     _pf(stat.get("ops")),
                "babip":   _pf(stat.get("babip")),
                "iso":     round(slg - avg, 3) if slg is not None and avg is not None else None,
                "k_pct":   round(so / pa, 4) if pa > 0 else None,
                "bb_pct":  round(bb / pa, 4) if pa > 0 else None,
                "woba":    woba,
                "war":     war_by_season.get(season_int),
            }))

    if not rows:
        return {"year_by_year": [], "career_totals": {}}

    # Career counting totals
    sum_keys = ["g", "ab", "pa", "h", "singles", "doubles", "triples", "hr",
                "r", "rbi", "sb", "cs", "bb", "so", "war"]
    career_totals: dict = {}
    for k in sum_keys:
        vals = [r[k] for r in rows if r.get(k) is not None]
        if vals:
            career_totals[k] = round(sum(vals), 1)
    if rows:
        career_totals["team"] = rows[-1].get("team", "")

    combined = [{"_type": "season", **r} for r in rows]
    if career_totals:
        combined.append({"_type": "career", **career_totals})
    try:
        cache.disk_save(cache_key, pd.DataFrame(combined))
    except Exception as exc:
        logger.warning(f"Career batting cache save failed: {exc}")

    return {"year_by_year": rows, "career_totals": career_totals}


def get_career_pitching_stats(mlbam_id: int) -> dict:
    """
    Year-by-year + career totals for a pitcher, using MLB Stats API + bRef WAR.
    Takes mlbam_id directly — no FanGraphs ID required.
    """
    cache_key = f"career_pit_mlb_{mlbam_id}"
    cached = cache.disk_get_fresh(cache_key, ttl_hours=24 * 7)
    if cached is not None:
        records = [_sanitize(r) for r in cached.to_dict(orient="records")]
        career_row = next((r for r in records if r.get("_type") == "career"), {})
        yby = [r for r in records if r.get("_type") == "season"]
        return {"year_by_year": yby, "career_totals": career_row}

    try:
        resp = httpx.get(
            f"{MLB_API_BASE}/people/{mlbam_id}/stats",
            params={"stats": "yearByYear", "group": "pitching", "gameType": "R"},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning(f"Career pitching fetch failed for {mlbam_id}: {exc}")
        return {"year_by_year": [], "career_totals": {}}

    war_by_season = _bref_war_pitch_player(mlbam_id)

    rows: list[dict] = []
    for sg in data.get("stats", []):
        for split in sg.get("splits", []):
            season_str = split.get("season", "")
            try:
                season_int = int(season_str)
            except (ValueError, TypeError):
                continue
            if season_int < 1980:
                continue

            stat = split.get("stat", {})
            team = split.get("team", {}).get("abbreviation", "")

            ip  = _ip_to_decimal(stat.get("inningsPitched", "0"))
            bb  = int(stat.get("baseOnBalls", 0) or 0)
            ibb = int(stat.get("intentionalWalks", 0) or 0)
            hbp = int(stat.get("hitByPitch", 0) or 0)
            so  = int(stat.get("strikeOuts", 0) or 0)
            hr  = int(stat.get("homeRuns", 0) or 0)
            h   = int(stat.get("hits", 0) or 0)
            er  = int(stat.get("earnedRuns", 0) or 0)
            r   = int(stat.get("runs", 0) or 0)
            bf  = int(stat.get("battersFaced", 0) or 0)

            ubb = bb - ibb
            fip = None
            if ip > 0:
                fip = round((13 * hr + 3 * (ubb + hbp) - 2 * so) / ip + FIP_CONSTANT, 2)

            lob_pct = None
            lob_denom = h + bb + hbp - 1.4 * hr
            if lob_denom > 0:
                lob_pct = round(min(max((h + bb + hbp - r) / lob_denom, 0), 1), 3)

            rows.append(_sanitize({
                "season": season_int,
                "team":   team,
                "g":      int(stat.get("gamesPlayed", 0) or 0),
                "gs":     int(stat.get("gamesStarted", 0) or 0),
                "w":      int(stat.get("wins", 0) or 0),
                "l":      int(stat.get("losses", 0) or 0),
                "sv":     int(stat.get("saves", 0) or 0),
                "hld":    int(stat.get("holds", 0) or 0),
                "ip":     round(ip, 1),
                "h":      h,
                "r":      r,
                "er":     er,
                "hr":     hr,
                "bb":     bb,
                "ibb":    ibb,
                "hbp":    hbp,
                "so":     so,
                "bf":     bf,
                "era":    _pf(stat.get("era")),
                "whip":   _pf(stat.get("whip")),
                "avg_against": _pf(stat.get("avg")),
                "babip":  _pf(stat.get("babip")),
                "fip":    fip,
                "lob_pct": lob_pct,
                "k_per_9":  round(so * 9 / ip, 2) if ip > 0 else None,
                "bb_per_9": round(bb * 9 / ip, 2) if ip > 0 else None,
                "k_pct":    round(so / bf, 4) if bf > 0 else None,
                "bb_pct":   round(bb / bf, 4) if bf > 0 else None,
                "war":      war_by_season.get(season_int),
            }))

    if not rows:
        return {"year_by_year": [], "career_totals": {}}

    sum_keys = ["g", "gs", "w", "l", "sv", "hld", "h", "r", "er", "hr", "bb", "so", "war"]
    career_totals: dict = {}
    for k in sum_keys:
        vals = [r[k] for r in rows if r.get(k) is not None]
        if vals:
            career_totals[k] = round(sum(vals), 1)
    ip_vals = [r["ip"] for r in rows if r.get("ip") is not None]
    if ip_vals:
        career_totals["ip"] = round(sum(ip_vals), 1)
    if rows:
        career_totals["team"] = rows[-1].get("team", "")

    combined = [{"_type": "season", **r} for r in rows]
    if career_totals:
        combined.append({"_type": "career", **career_totals})
    try:
        cache.disk_save(cache_key, pd.DataFrame(combined))
    except Exception as exc:
        logger.warning(f"Career pitching cache save failed: {exc}")

    return {"year_by_year": rows, "career_totals": career_totals}


# ---------------------------------------------------------------------------
# Team stats (aggregated from individual player stats)
# ---------------------------------------------------------------------------

def get_team_batting_stats(season: int) -> pd.DataFrame:
    """Team batting stats — sum individual stats from MLB API, group by team."""
    key = f"team_batting_mlb_{season}"
    cached = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if cached is not None:
        return cached

    df = get_batting_stats(season, min_pa=0)
    if df.empty:
        return pd.DataFrame()

    # Ensure war column exists — bRef fetch may have failed
    if "war" not in df.columns:
        df = df.copy()
        df["war"] = np.nan

    agg = (
        df.groupby("team")
        .agg(
            g=("g", "max"),
            pa=("pa", "sum"),
            ab=("ab", "sum"),
            h=("h", "sum"),
            doubles=("doubles", "sum"),
            triples=("triples", "sum"),
            hr=("hr", "sum"),
            r=("r", "sum"),
            rbi=("rbi", "sum"),
            sb=("sb", "sum"),
            bb=("bb", "sum"),
            so=("so", "sum"),
            hbp=("hbp", "sum"),
            sf=("sf", "sum"),
            ibb=("ibb", "sum"),
            war=("war", "sum"),
        )
        .reset_index()
    )
    agg = agg.rename(columns={"team": "Team"})

    # Compute team rate stats
    agg["AVG"]  = (agg["h"] / agg["ab"].replace(0, np.nan)).round(3)
    agg["OBP"]  = ((agg["h"] + agg["bb"] + agg["hbp"]) /
                   (agg["ab"] + agg["bb"] + agg["hbp"] + agg["sf"]).replace(0, np.nan)).round(3)
    total_bases = agg["h"] + agg["doubles"] + 2 * agg["triples"] + 3 * agg["hr"]
    agg["SLG"]  = (total_bases / agg["ab"].replace(0, np.nan)).round(3)
    agg["OPS"]  = agg["OBP"] + agg["SLG"]
    agg["ISO"]  = (agg["SLG"] - agg["AVG"]).round(3)

    w = _w(season)
    singles = agg["h"] - agg["doubles"] - agg["triples"] - agg["hr"]
    ubb = agg["bb"] - agg["ibb"]
    woba_denom = agg["ab"] + ubb + agg["hbp"] + agg["sf"]
    agg["wOBA"] = (
        (w["bb"] * ubb + w["hbp"] * agg["hbp"] + w["single"] * singles
         + w["double"] * agg["doubles"] + w["triple"] * agg["triples"] + w["hr"] * agg["hr"])
        / woba_denom.replace(0, np.nan)
    ).round(3)

    agg["WAR"] = agg["war"].round(1)

    # Uppercase aliases expected by the frontend
    agg["HR"]  = agg["hr"]
    agg["R"]   = agg["r"]
    agg["RBI"] = agg["rbi"]
    agg["SB"]  = agg["sb"]
    # wRC+ at team level: (wOBA / lg_wOBA) * 100
    lg_woba = agg["wOBA"].median()
    if lg_woba and lg_woba > 0:
        agg["wRC+"] = (agg["wOBA"] / lg_woba * 100).round(1)
    else:
        agg["wRC+"] = np.nan

    cache.disk_save(key, agg)
    return agg


def get_team_pitching_stats(season: int) -> pd.DataFrame:
    """Team pitching stats — sum individual stats from MLB API, group by team."""
    key = f"team_pitching_mlb_{season}"
    cached = cache.disk_get_fresh(key, ttl_hours=settings.FANGRAPHS_CACHE_TTL_HOURS)
    if cached is not None:
        return cached

    df = get_pitching_stats(season, min_ip=0)
    if df.empty:
        return pd.DataFrame()

    # Ensure war column exists — bRef fetch may have failed
    if "war" not in df.columns:
        df = df.copy()
        df["war"] = np.nan

    agg = (
        df.groupby("team")
        .agg(
            ip=("ip", "sum"),
            h=("h", "sum"),
            r=("r", "sum"),
            er=("er", "sum"),
            hr=("hr", "sum"),
            bb=("bb", "sum"),
            ibb=("ibb", "sum"),
            hbp=("hbp", "sum"),
            so=("so", "sum"),
            bf=("bf", "sum"),
            war=("war", "sum"),
        )
        .reset_index()
    )
    agg = agg.rename(columns={"team": "Team"})

    ip = agg["ip"].replace(0, np.nan)
    bf = agg["bf"].replace(0, np.nan)
    agg["ERA"]  = (9 * agg["er"] / ip).round(2)
    agg["WHIP"] = ((agg["h"] + agg["bb"]) / ip).round(3)
    agg["K9"]   = (agg["so"] * 9 / ip).round(2)
    agg["BB9"]  = (agg["bb"] * 9 / ip).round(2)

    ubb = agg["bb"] - agg["ibb"]
    fip_num = 13 * agg["hr"] + 3 * (ubb + agg["hbp"]) - 2 * agg["so"]
    agg["FIP"]  = (fip_num / ip + FIP_CONSTANT).round(2)

    agg["WAR"] = agg["war"].round(1)

    cache.disk_save(key, agg)
    return agg
