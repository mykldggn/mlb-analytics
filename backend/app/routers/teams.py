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
