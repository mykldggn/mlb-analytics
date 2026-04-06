from __future__ import annotations

"""
Derived stat calculations and the custom Park Favorability Index (PFI).

Park Favorability Index (PFI)
------------------------------
A composite 0–200 score (100 = perfectly neutral) that quantifies how much a
ballpark helps or hurts hitters/pitchers relative to league average.

Methodology (3-year rolling window of Statcast + FanGraphs park-level splits):

Inputs per park (home vs. road, all teams):
  - run_factor     : (H_R/G) / (A_R/G)   — runs scored per game, home vs away
  - hr_factor      : (H_HR/PA) / (A_HR/PA)
  - babip_factor   : (H_BABIP) / (A_BABIP)
  - k_factor       : (H_K%) / (A_K%)      — lower K% at home = hitter-friendly
  - bb_factor      : (H_BB%) / (A_BB%)    — higher BB% at home = hitter-friendly
  - ev_factor      : (H_avg_EV) / (A_avg_EV) — exit velocity favors hitters if >1

Each factor is normalized so 1.0 = neutral.

Batter PFI = 100 * (
    run_factor   * 0.30
  + hr_factor    * 0.30
  + babip_factor * 0.20
  + (2 - k_factor) * 0.10   # invert: fewer Ks = hitter-friendly → pushes toward 200
  + bb_factor    * 0.05
  + ev_factor    * 0.05
)

Pitcher PFI = 200 - Batter_PFI   (perfect inverse on the 0-200 scale)

Interpretation:
  Batter PFI > 100  : hitter-friendly  (Coors Field ≈ 165, Petco Park ≈ 68)
  Pitcher PFI > 100 : pitcher-friendly (Petco Park ≈ 132, Coors Field ≈ 35)
"""

from typing import Optional
import numpy as np
import pandas as pd
from scipy import stats as scipy_stats


# ---------------------------------------------------------------------------
# General helpers
# ---------------------------------------------------------------------------

def compute_iso(slg: float, avg: float) -> Optional[float]:
    """Isolated Power = SLG - AVG."""
    if slg is None or avg is None:
        return None
    return round(slg - avg, 3)


def compute_babip(h: int, hr: int, ab: int, k: int, sf: int = 0) -> Optional[float]:
    """BABIP = (H - HR) / (AB - K - HR + SF)."""
    denom = ab - k - hr + sf
    if denom <= 0:
        return None
    return round((h - hr) / denom, 3)


def compute_ops_plus(obp: float, slg: float, lg_obp: float, lg_slg: float) -> Optional[float]:
    """OPS+ = 100 * (OBP/lgOBP + SLG/lgSLG - 1)."""
    if None in (obp, slg, lg_obp, lg_slg) or lg_obp == 0 or lg_slg == 0:
        return None
    return round(100 * (obp / lg_obp + slg / lg_slg - 1), 1)


def compute_fip(hr: int, bb: int, hbp: int, k: int, ip: float, fip_constant: float = 3.10) -> Optional[float]:
    """FIP = (13*HR + 3*(BB+HBP) - 2*K) / IP + FIP_constant."""
    if ip <= 0:
        return None
    return round((13 * hr + 3 * (bb + hbp) - 2 * k) / ip + fip_constant, 2)


def compute_percentile(value: float, series: pd.Series, lower_is_better: bool = False) -> float:
    """Return 0–100 percentile of value within series (higher = better by default)."""
    clean = series.dropna()
    if len(clean) == 0:
        return 50.0
    pct = float(scipy_stats.percentileofscore(clean, value, kind="rank"))
    return round(100 - pct if lower_is_better else pct, 1)


def compute_rolling_average(series: pd.Series, window: int = 3) -> pd.Series:
    return series.rolling(window=window, min_periods=1).mean()


# ---------------------------------------------------------------------------
# Park Favorability Index (PFI)
# ---------------------------------------------------------------------------

def _safe_ratio(numerator: float, denominator: float, neutral: float = 1.0) -> float:
    """Return numerator/denominator or neutral if denominator is zero/None."""
    if not denominator or denominator == 0:
        return neutral
    return numerator / denominator


def compute_park_favorability(
    home_runs_per_pa: float,
    away_runs_per_pa: float,
    home_hr_per_pa: float,
    away_hr_per_pa: float,
    home_babip: float,
    away_babip: float,
    home_k_pct: float,
    away_k_pct: float,
    home_bb_pct: float,
    away_bb_pct: float,
    home_avg_ev: float,
    away_avg_ev: float,
) -> dict:
    """
    Compute the Park Favorability Index for a single park using
    home-vs-road splits aggregated across all teams over a 3-year window.

    Returns:
        {
          "batter_pfi": float (0-200, >100 = hitter-friendly),
          "pitcher_pfi": float (0-200, >100 = pitcher-friendly),
          "components": { "run_factor": ..., "hr_factor": ..., ... }
        }
    """
    run_factor   = _safe_ratio(home_runs_per_pa, away_runs_per_pa)
    hr_factor    = _safe_ratio(home_hr_per_pa,   away_hr_per_pa)
    babip_factor = _safe_ratio(home_babip,        away_babip)
    k_factor     = _safe_ratio(home_k_pct,        away_k_pct)
    bb_factor    = _safe_ratio(home_bb_pct,        away_bb_pct)
    ev_factor    = _safe_ratio(home_avg_ev,        away_avg_ev)

    # Batter PFI: higher = more hitter-friendly
    batter_raw = (
        run_factor        * 0.30
        + hr_factor       * 0.30
        + babip_factor    * 0.20
        + (2 - k_factor)  * 0.10   # invert K: fewer Ks → hitter-friendly
        + bb_factor       * 0.05
        + ev_factor       * 0.05
    )

    # Scale: neutral (all factors = 1.0) → batter_raw = 1.0 exactly
    # Amplify deviations from neutral by 1.6× so parks spread further from 100
    # (Coors ~1.20 raw → PFI ≈ 132; Petco ~0.87 raw → PFI ≈ 79)
    # Map raw 1.0 → 100, cap 0–200
    amplified = (batter_raw - 1.0) * 1.6 + 1.0
    batter_pfi = round(max(0.0, min(200.0, amplified * 100)), 1)
    pitcher_pfi = round(200.0 - batter_pfi, 1)

    return {
        "batter_pfi": batter_pfi,
        "pitcher_pfi": pitcher_pfi,
        "components": {
            "run_factor":   round(run_factor,   4),
            "hr_factor":    round(hr_factor,    4),
            "babip_factor": round(babip_factor, 4),
            "k_factor":     round(k_factor,     4),
            "bb_factor":    round(bb_factor,    4),
            "ev_factor":    round(ev_factor,    4),
        },
    }


def build_park_factors_from_statcast(df: pd.DataFrame) -> pd.DataFrame:
    """
    Given a multi-year Statcast pitch-level DataFrame with 'home_team', 'away_team',
    'if_fielding_alignment', 'launch_speed', 'estimated_woba_using_speedangle', etc.,
    compute per-park PFI scores.

    Returns a DataFrame with columns:
        park_name, team_abbr, venue_id,
        batter_pfi, pitcher_pfi, run_factor, hr_factor,
        babip_factor, k_factor, bb_factor, ev_factor,
        sample_size
    """
    needed = {"home_team", "events", "launch_speed", "estimated_ba_using_speedangle"}
    missing = needed - set(df.columns)
    if missing:
        raise ValueError(f"Statcast DataFrame missing columns: {missing}")

    results = []

    for team, grp in df.groupby("home_team"):
        home = grp  # all pitches thrown at this park (home team's games)
        # away = same team's road games — filter parent df where away_team == team
        away = df[df["away_team"] == team]

        def rates(subdf):
            pa = len(subdf)
            if pa == 0:
                return {}
            hits = subdf["events"].isin(["single", "double", "triple", "home_run"])
            hrs  = subdf["events"] == "home_run"
            ks   = subdf["events"] == "strikeout"
            bbs  = subdf["events"] == "walk"
            in_play = subdf["events"].isin(["single", "double", "triple", "field_out",
                                             "grounded_into_double_play", "force_out",
                                             "sac_fly", "fielders_choice"])
            xba_vals = subdf["estimated_ba_using_speedangle"].dropna()
            babip_val = (xba_vals.sum() / len(xba_vals)) if len(xba_vals) > 0 else None
            ev_vals  = subdf["launch_speed"].dropna()
            return {
                "runs_per_pa": hits.sum() / pa,
                "hr_per_pa":   hrs.sum()  / pa,
                "babip":       babip_val,
                "k_pct":       ks.sum()   / pa,
                "bb_pct":      bbs.sum()  / pa,
                "avg_ev":      ev_vals.mean() if len(ev_vals) > 0 else 92.0,
            }

        h = rates(home)
        a = rates(away)
        if not h or not a:
            continue

        pfi = compute_park_favorability(
            home_runs_per_pa=h["runs_per_pa"], away_runs_per_pa=a["runs_per_pa"],
            home_hr_per_pa=h["hr_per_pa"],     away_hr_per_pa=a["hr_per_pa"],
            home_babip=h["babip"] or 0.300,    away_babip=a["babip"] or 0.300,
            home_k_pct=h["k_pct"],             away_k_pct=a["k_pct"],
            home_bb_pct=h["bb_pct"],           away_bb_pct=a["bb_pct"],
            home_avg_ev=h["avg_ev"],           away_avg_ev=a["avg_ev"],
        )

        results.append({
            "team_abbr":   team,
            "batter_pfi":  pfi["batter_pfi"],
            "pitcher_pfi": pfi["pitcher_pfi"],
            **pfi["components"],
            "sample_size": len(home),
        })

    return pd.DataFrame(results).sort_values("batter_pfi", ascending=False).reset_index(drop=True)
