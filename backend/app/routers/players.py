from __future__ import annotations

from fastapi import APIRouter, Depends
from typing import Optional

from app.config import settings
from app.core.exceptions import PlayerNotFoundError
from app.core import player_id_map as pid_map
from app.services.mlb_api_service import MLBApiService, get_mlb_api_service, headshot_url

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/{player_id}")
async def get_player_profile(
    player_id: int,
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    try:
        data = await mlb.get_player(player_id)
    except Exception:
        raise PlayerNotFoundError(player_id)
    if not data:
        raise PlayerNotFoundError(player_id)

    return {
        "mlbam_id": data.get("id"),
        "fullName": data.get("fullName"),
        "firstName": data.get("firstName"),
        "lastName": data.get("lastName"),
        "birthDate": data.get("birthDate"),
        "age": data.get("currentAge"),
        "height": data.get("height"),
        "weight": data.get("weight"),
        "batSide": data.get("batSide", {}).get("description"),
        "pitchHand": data.get("pitchHand", {}).get("description"),
        "mlbDebutDate": data.get("mlbDebutDate"),
        "birthCity": data.get("birthCity"),
        "birthCountry": data.get("birthCountry"),
        "currentTeam": data.get("currentTeam", {}).get("name"),
        "currentTeamId": data.get("currentTeam", {}).get("id"),
        "primaryPosition": data.get("primaryPosition", {}).get("abbreviation"),
        "active": data.get("active", True),
        "headshot_url": headshot_url(player_id),
        "fangraphs_id": pid_map.get_fangraphs_id(player_id),
    }


@router.get("/{player_id}/bio")
async def get_player_bio(
    player_id: int,
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    """Detailed bio: education, draft info, and MLB team history."""
    try:
        data = await mlb.get_player_bio(player_id)
    except Exception:
        data = {}
    return data


@router.get("/{player_id}/splits/{season}")
async def get_player_splits(
    player_id: int,
    season: int,
    group: str = "hitting",
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    splits = await mlb.get_player_splits(player_id, season, group)
    return {"splits": splits, "season": season, "group": group}


@router.get("/{player_id}/game-log/{season}")
async def get_player_game_log(
    player_id: int,
    season: int,
    group: str = "hitting",
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    log = await mlb.get_player_game_log(player_id, season, group)
    return {"game_log": log, "season": season}
