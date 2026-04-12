from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.config import settings
from app.services.mlb_api_service import MLBApiService, get_mlb_api_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("")
async def get_teams(
    season: int = Query(default=settings.CURRENT_SEASON),
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    teams = await mlb.get_teams(season)
    return {"teams": teams, "season": season}


@router.get("/{team_id}/roster")
async def get_roster(
    team_id: int,
    season: int = Query(default=settings.CURRENT_SEASON),
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    roster = await mlb.get_roster(team_id, season)
    return {"team_id": team_id, "season": season, "roster": roster}


@router.get("/standings")
async def get_standings(
    season: int = Query(default=settings.CURRENT_SEASON),
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    standings = await mlb.get_standings(season)
    return {"season": season, "standings": standings}


@router.get("/analytics/all")
async def get_team_analytics_all(
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    """
    Multi-season team analytics (2015–present).
    Rate stats (win_pct, wRC+, FIP, ERA) are averaged per team across all seasons.
    WAR is averaged per season so teams with fewer seasons aren't penalised.
    Returns the same shape as /analytics/{season} so the frontend needs no changes.
    """
    import asyncio
    import pandas as pd
    from app.core import cache as disk_cache
    from app.services.fangraphs_service import get_team_batting_stats, get_team_pitching_stats

    BAT_KEY = "team_analytics_all_batting_v2"
    PIT_KEY = "team_analytics_all_pitching_v2"
    STD_KEY = "team_analytics_all_standings_v2"

    bat_cached = disk_cache.disk_get_fresh(BAT_KEY, ttl_hours=24)
    pit_cached = disk_cache.disk_get_fresh(PIT_KEY, ttl_hours=24)
    std_cached = disk_cache.disk_get_fresh(STD_KEY, ttl_hours=24)

    if bat_cached is not None and pit_cached is not None and std_cached is not None:
        def _to_records(df):
            return [{k: (None if v != v else v) for k, v in r.items()} for r in df.to_dict(orient="records")]

        standings_map = {}
        for r in std_cached.to_dict(orient="records"):
            abbr = r.pop("abbr", None)
            if abbr:
                standings_map[abbr] = {k: (None if v != v else v) for k, v in r.items()}

        return {
            "season": 0,
            "batting": _to_records(bat_cached),
            "pitching": _to_records(pit_cached),
            "standings": standings_map,
            "errors": [],
        }

    SEASONS = list(range(2015, settings.CURRENT_SEASON + 1))
    loop = asyncio.get_event_loop()

    # ── Per-season accumulator dicts ────────────────────────────────────────
    # Batting: Team → lists of per-season values
    bat_acc: dict[str, dict[str, list]] = {}
    pit_acc: dict[str, dict[str, list]] = {}
    # Standings: abbr → list of per-season dicts
    std_acc: dict[str, list] = {}
    errors: list[str] = []

    for season in SEASONS:
        # Batting
        try:
            bat_df = await loop.run_in_executor(None, lambda s=season: get_team_batting_stats(s))
            for r in bat_df.to_dict(orient="records"):
                team = r.get("Team", "")
                if not team:
                    continue
                acc = bat_acc.setdefault(team, {"WAR": [], "wRC+": [], "OPS": [], "HR": [], "R": []})
                for k in acc:
                    v = r.get(k)
                    if v is not None and v == v:  # skip NaN
                        acc[k].append(float(v))
        except Exception as exc:
            errors.append(f"Batting {season}: {exc}")

        # Pitching
        try:
            pit_df = await loop.run_in_executor(None, lambda s=season: get_team_pitching_stats(s))
            for r in pit_df.to_dict(orient="records"):
                team = r.get("Team", "")
                if not team:
                    continue
                acc = pit_acc.setdefault(team, {"WAR": [], "ERA": [], "FIP": []})
                for k in acc:
                    v = r.get(k)
                    if v is not None and v == v:
                        acc[k].append(float(v))
        except Exception as exc:
            errors.append(f"Pitching {season}: {exc}")

        # Standings
        try:
            team_id_to_abbr: dict = {}
            all_teams = await mlb.get_teams(season)
            for t in all_teams:
                tid = t.get("id")
                abbr = t.get("abbreviation", "")
                if tid and abbr:
                    team_id_to_abbr[tid] = abbr

            records = await mlb.get_standings(season)
            for division in records:
                for team_rec in division.get("teamRecords", []):
                    team_info = team_rec.get("team", {})
                    tid = team_info.get("id")
                    abbr = team_id_to_abbr.get(tid, "")
                    if not abbr:
                        continue
                    std_acc.setdefault(abbr, []).append({
                        "team_name": team_info.get("name", ""),
                        "win_pct": float(team_rec.get("winningPercentage", "0") or 0),
                        "w": int(team_rec.get("wins", 0)),
                        "l": int(team_rec.get("losses", 0)),
                        "run_diff": int(team_rec.get("runDifferential", 0)),
                        "rs": int(team_rec.get("runsScored", 0)),
                        "ra": int(team_rec.get("runsAllowed", 0)),
                    })
        except Exception as exc:
            errors.append(f"Standings {season}: {exc}")

    # ── Aggregate ────────────────────────────────────────────────────────────
    def _avg(lst): return round(sum(lst) / len(lst), 3) if lst else None

    batting_rows = []
    for team, acc in bat_acc.items():
        batting_rows.append({
            "Team":  team,
            "WAR":   _avg(acc["WAR"]),    # avg per season
            "wRC+":  _avg(acc["wRC+"]),
            "OPS":   _avg(acc["OPS"]),
            "HR":    _avg(acc["HR"]),
            "R":     _avg(acc["R"]),
        })

    pitching_rows = []
    for team, acc in pit_acc.items():
        pitching_rows.append({
            "Team": team,
            "WAR":  _avg(acc["WAR"]),
            "ERA":  _avg(acc["ERA"]),
            "FIP":  _avg(acc["FIP"]),
        })

    standings_map: dict = {}
    for abbr, seasons_list in std_acc.items():
        n = len(seasons_list)
        standings_map[abbr] = {
            "team_name": seasons_list[-1]["team_name"],
            # Rate stat — simple average across seasons
            "win_pct":  round(sum(s["win_pct"] for s in seasons_list) / n, 3),
            # Counting stats — averaged per season so teams with more history aren't inflated
            "w":        round(sum(s["w"] for s in seasons_list) / n, 1),
            "l":        round(sum(s["l"] for s in seasons_list) / n, 1),
            "run_diff": round(sum(s["run_diff"] for s in seasons_list) / n, 1),
            "rs":       round(sum(s["rs"] for s in seasons_list) / n, 1),
            "ra":       round(sum(s["ra"] for s in seasons_list) / n, 1),
            "n_seasons": n,
        }

    # ── Save aggregated results to disk cache ────────────────────────────────
    import numpy as np
    try:
        disk_cache.disk_save(BAT_KEY, pd.DataFrame(batting_rows))
        disk_cache.disk_save(PIT_KEY, pd.DataFrame(pitching_rows))
        std_rows = [{"abbr": abbr, **v} for abbr, v in standings_map.items()]
        disk_cache.disk_save(STD_KEY, pd.DataFrame(std_rows))
    except Exception as exc:
        logger.warning(f"Could not cache all-seasons aggregation: {exc}")

    logger.info(f"All-seasons analytics built: {len(batting_rows)} batting teams, {len(pitching_rows)} pitching teams, {len(standings_map)} standing teams")

    return {
        "season": 0,
        "batting": batting_rows,
        "pitching": pitching_rows,
        "standings": standings_map,
        "errors": errors,
    }


@router.get("/analytics/{season}")
async def get_team_analytics(
    season: int,
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    """
    Combined team batting WAR, pitching WAR, and win/loss records for a season.
    Used by the Team Historical Analytics page to surface correlations.
    """
    import asyncio
    from app.services.fangraphs_service import get_team_batting_stats, get_team_pitching_stats

    # Run synchronous stat builds in a thread to avoid blocking the event loop
    loop = asyncio.get_event_loop()

    batting_records = []
    pitching_records = []
    errors = []
    try:
        bat_df = await loop.run_in_executor(None, lambda: get_team_batting_stats(season))
        batting_records = [{k: (None if v != v else v) for k, v in r.items()} for r in bat_df.to_dict(orient="records")]
        logger.info(f"Team batting: {len(batting_records)} teams for {season}")
    except Exception as exc:
        import traceback
        msg = f"Team batting stats failed for {season}: {exc}"
        logger.error(msg + "\n" + traceback.format_exc())
        errors.append(msg)

    try:
        pit_df = await loop.run_in_executor(None, lambda: get_team_pitching_stats(season))
        pitching_records = [{k: (None if v != v else v) for k, v in r.items()} for r in pit_df.to_dict(orient="records")]
        logger.info(f"Team pitching: {len(pitching_records)} teams for {season}")
    except Exception as exc:
        import traceback
        msg = f"Team pitching stats failed for {season}: {exc}"
        logger.error(msg + "\n" + traceback.format_exc())
        errors.append(msg)

    # Build team_id → abbreviation map from the teams endpoint
    team_id_to_abbr: dict = {}
    try:
        all_teams = await mlb.get_teams(season)
        for t in all_teams:
            tid = t.get("id")
            abbr = t.get("abbreviation", "")
            if tid and abbr:
                team_id_to_abbr[tid] = abbr
    except Exception as exc:
        logger.warning(f"Teams fetch failed: {exc}")

    # MLB API standings → keyed by MLB abbreviation (CWS, KC, SD, SF, TB, WSH)
    # Frontend resolveAbbr converts FanGraphs abbrs (CHW→CWS, KCR→KC etc.) to match these keys
    standings_map: dict = {}
    try:
        records = await mlb.get_standings(season)
        for division in records:
            for team_rec in division.get("teamRecords", []):
                team_info = team_rec.get("team", {})
                name = team_info.get("name", "")
                tid = team_info.get("id")
                abbr = team_id_to_abbr.get(tid, "")
                if not abbr:
                    continue
                standings_map[abbr] = {
                    "team_name": name,
                    "w": team_rec.get("wins", 0),
                    "l": team_rec.get("losses", 0),
                    "win_pct": float(team_rec.get("winningPercentage", "0") or 0),
                    "run_diff": team_rec.get("runDifferential", 0),
                    "rs": team_rec.get("runsScored", 0),
                    "ra": team_rec.get("runsAllowed", 0),
                }
        logger.info(f"Standings loaded: {len(standings_map)} teams for {season}")
    except Exception as exc:
        logger.warning(f"Standings fetch failed for {season}: {exc}")

    return {
        "season": season,
        "batting": batting_records,
        "pitching": pitching_records,
        "standings": standings_map,
        "errors": errors,
    }
