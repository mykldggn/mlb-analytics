from __future__ import annotations

from fastapi import APIRouter, Query
from app.services.mlb_api_service import MLBApiService, get_mlb_api_service, headshot_url
from fastapi import Depends

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/players")
async def search_players(
    q: str = Query(min_length=2, description="Player name prefix"),
    mlb: MLBApiService = Depends(get_mlb_api_service),
):
    players = await mlb.search_players(q)
    return [
        {
            "mlbam_id": p["mlbam_id"],
            "fullName": p["fullName"],
            "position": p.get("position"),
            "team": p.get("team_abbr") or "",
            "active": p.get("active", True),
            "headshot_url": p.get("headshot_url") or headshot_url(p["mlbam_id"]),
        }
        for p in players
        if p.get("mlbam_id")
    ]
