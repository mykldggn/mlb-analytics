from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class BattingStats(BaseModel):
    season: int
    fangraphs_id: Optional[int] = None
    # Traditional
    g: Optional[int] = None
    pa: Optional[int] = None
    ab: Optional[int] = None
    h: Optional[int] = None
    singles: Optional[int] = None
    doubles: Optional[int] = None
    triples: Optional[int] = None
    hr: Optional[int] = None
    r: Optional[int] = None
    rbi: Optional[int] = None
    sb: Optional[int] = None
    cs: Optional[int] = None
    bb: Optional[int] = None
    so: Optional[int] = None
    avg: Optional[float] = None
    obp: Optional[float] = None
    slg: Optional[float] = None
    ops: Optional[float] = None
    # Advanced
    war: Optional[float] = None
    wrc_plus: Optional[float] = None
    woba: Optional[float] = None
    wraa: Optional[float] = None
    iso: Optional[float] = None
    babip: Optional[float] = None
    ops_plus: Optional[float] = None
    wpa: Optional[float] = None
    re24: Optional[float] = None
    clutch: Optional[float] = None
    bsr: Optional[float] = None
    # Plate Discipline
    k_pct: Optional[float] = None
    bb_pct: Optional[float] = None
    bb_k_ratio: Optional[float] = None
    o_swing_pct: Optional[float] = None
    z_swing_pct: Optional[float] = None
    swing_pct: Optional[float] = None
    o_contact_pct: Optional[float] = None
    z_contact_pct: Optional[float] = None
    contact_pct: Optional[float] = None
    zone_pct: Optional[float] = None
    f_strike_pct: Optional[float] = None
    swstr_pct: Optional[float] = None
    csw_pct: Optional[float] = None
    # Batted Ball
    gb_pct: Optional[float] = None
    fb_pct: Optional[float] = None
    ld_pct: Optional[float] = None
    iffb_pct: Optional[float] = None
    hr_fb_pct: Optional[float] = None
    pull_pct: Optional[float] = None
    cent_pct: Optional[float] = None
    oppo_pct: Optional[float] = None
    hard_pct: Optional[float] = None
    soft_pct: Optional[float] = None
    med_pct: Optional[float] = None
    # Statcast
    xba: Optional[float] = None
    xslg: Optional[float] = None
    xwoba: Optional[float] = None
    xobp: Optional[float] = None
    barrel_pct: Optional[float] = None
    hard_hit_pct: Optional[float] = None
    avg_ev: Optional[float] = None
    avg_la: Optional[float] = None
    sprint_speed: Optional[float] = None


class SplitStats(BaseModel):
    split_name: str  # "vs Left", "vs Right", "Home", "Away"
    avg: Optional[float] = None
    obp: Optional[float] = None
    slg: Optional[float] = None
    ops: Optional[float] = None
    woba: Optional[float] = None
    hr: Optional[int] = None
    rbi: Optional[int] = None
    k_pct: Optional[float] = None
    bb_pct: Optional[float] = None
    pa: Optional[int] = None


class SprayChartPoint(BaseModel):
    hc_x: float
    hc_y: float
    bb_type: Optional[str] = None
    events: Optional[str] = None
    launch_speed: Optional[float] = None
    launch_angle: Optional[float] = None


class StatTrendPoint(BaseModel):
    season: int
    value: Optional[float] = None
