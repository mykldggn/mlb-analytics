from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class PitchingStats(BaseModel):
    season: int
    fangraphs_id: Optional[int] = None
    # Traditional
    g: Optional[int] = None
    gs: Optional[int] = None
    ip: Optional[float] = None
    w: Optional[int] = None
    l: Optional[int] = None
    sv: Optional[int] = None
    hld: Optional[int] = None
    h: Optional[int] = None
    r: Optional[int] = None
    er: Optional[int] = None
    hr: Optional[int] = None
    bb: Optional[int] = None
    so: Optional[int] = None
    era: Optional[float] = None
    whip: Optional[float] = None
    avg_against: Optional[float] = None
    babip: Optional[float] = None
    lob_pct: Optional[float] = None
    # Advanced
    war: Optional[float] = None
    fip: Optional[float] = None
    xfip: Optional[float] = None
    siera: Optional[float] = None
    era_minus: Optional[float] = None
    fip_minus: Optional[float] = None
    xfip_minus: Optional[float] = None
    wpa: Optional[float] = None
    clutch: Optional[float] = None
    # Rate Stats
    k_per_9: Optional[float] = None
    bb_per_9: Optional[float] = None
    k_bb_ratio: Optional[float] = None
    hr_per_9: Optional[float] = None
    k_pct: Optional[float] = None
    bb_pct: Optional[float] = None
    k_minus_bb_pct: Optional[float] = None
    # Batted Ball
    gb_pct: Optional[float] = None
    fb_pct: Optional[float] = None
    ld_pct: Optional[float] = None
    hr_fb_pct: Optional[float] = None
    # Plate Discipline
    o_swing_pct: Optional[float] = None
    z_swing_pct: Optional[float] = None
    contact_pct: Optional[float] = None
    zone_pct: Optional[float] = None
    f_strike_pct: Optional[float] = None
    swstr_pct: Optional[float] = None
    csw_pct: Optional[float] = None
    # Stuff Metrics
    stuff_plus: Optional[float] = None
    location_plus: Optional[float] = None
    pitching_plus: Optional[float] = None


class PitchType(BaseModel):
    pitch_type_code: str
    pitch_type_name: str
    usage_pct: Optional[float] = None
    avg_speed: Optional[float] = None
    avg_spin_rate: Optional[float] = None
    break_x: Optional[float] = None   # horizontal movement (in)
    break_z: Optional[float] = None   # vertical induced break (in)
    whiff_pct: Optional[float] = None
    put_away_pct: Optional[float] = None
    csw_pct: Optional[float] = None


class PitchArsenal(BaseModel):
    pitches: list[PitchType]


class PitchMovementPoint(BaseModel):
    pitch_type: str
    avg_speed: Optional[float] = None
    pitches_thrown: int = 0
    break_z: Optional[float] = None   # induced vertical movement
    break_x: Optional[float] = None   # horizontal movement
