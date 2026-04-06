from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class PlayerBio(BaseModel):
    mlbam_id: int
    fullName: str
    firstName: str
    lastName: str
    birthDate: Optional[str] = None
    age: Optional[int] = None
    height: Optional[str] = None
    weight: Optional[int] = None
    batSide: Optional[str] = None
    pitchHand: Optional[str] = None
    mlbDebutDate: Optional[str] = None
    birthCity: Optional[str] = None
    birthCountry: Optional[str] = None
    currentTeam: Optional[str] = None
    currentTeamId: Optional[int] = None
    primaryPosition: Optional[str] = None
    active: bool = True
    headshot_url: str


class PlayerSearchResult(BaseModel):
    mlbam_id: int
    fullName: str
    position: Optional[str] = None
    team: Optional[str] = None
    headshot_url: str
