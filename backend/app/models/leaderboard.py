from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    mlbam_id: Optional[int] = None
    fangraphs_id: Optional[int] = None
    player_name: str
    team: Optional[str] = None
    position: Optional[str] = None
    headshot_url: Optional[str] = None
    stats: dict[str, Any]


class LeaderboardResponse(BaseModel):
    data: list[LeaderboardEntry]
    total: int
    page: int
    page_size: int
    sort_by: str
    season: int


class ParkFactorEntry(BaseModel):
    team_abbr: str
    park_name: Optional[str] = None
    venue_id: Optional[int] = None
    batter_pfi: float
    pitcher_pfi: float
    run_factor: float
    hr_factor: float
    babip_factor: float
    k_factor: float
    bb_factor: float
    ev_factor: float
    sample_size: int
    seasons_used: list[int]
    interpretation: str  # e.g. "Hitter-friendly", "Neutral", "Pitcher-friendly"
