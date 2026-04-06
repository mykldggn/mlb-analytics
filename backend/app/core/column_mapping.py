from __future__ import annotations

"""
Normalizes FanGraphs column names (which contain special characters like +, %, /)
into clean snake_case keys safe for JSON serialization and TypeScript interfaces.
"""

BATTING_COLUMN_MAP: dict[str, str] = {
    # Identity
    "Name": "name",
    "Team": "team",
    "Age": "age",
    "G": "g",
    "AB": "ab",
    "PA": "pa",
    # Traditional
    "H": "h",
    "1B": "singles",
    "2B": "doubles",
    "3B": "triples",
    "HR": "hr",
    "R": "r",
    "RBI": "rbi",
    "SB": "sb",
    "CS": "cs",
    "BB": "bb",
    "SO": "so",
    "AVG": "avg",
    "OBP": "obp",
    "SLG": "slg",
    "OPS": "ops",
    "SF": "sf",
    "SH": "sh",
    "IBB": "ibb",
    "HBP": "hbp",
    # Advanced
    "WAR": "war",
    "wRC+": "wrc_plus",
    "wOBA": "woba",
    "wRAA": "wraa",
    "ISO": "iso",
    "BABIP": "babip",
    "OPS+": "ops_plus",
    "WPA": "wpa",
    "RE24": "re24",
    "REW": "rew",
    "pLI": "pli",
    "phLI": "phli",
    "Clutch": "clutch",
    "BsR": "bsr",
    "Spd": "spd",
    # Plate Discipline
    "K%": "k_pct",
    "BB%": "bb_pct",
    "BB/K": "bb_k_ratio",
    "O-Swing%": "o_swing_pct",
    "Z-Swing%": "z_swing_pct",
    "Swing%": "swing_pct",
    "O-Contact%": "o_contact_pct",
    "Z-Contact%": "z_contact_pct",
    "Contact%": "contact_pct",
    "Zone%": "zone_pct",
    "F-Strike%": "f_strike_pct",
    "SwStr%": "swstr_pct",
    "CStr%": "cstr_pct",
    "CSW%": "csw_pct",
    # Batted Ball
    "GB%": "gb_pct",
    "FB%": "fb_pct",
    "LD%": "ld_pct",
    "IFFB%": "iffb_pct",
    "HR/FB": "hr_fb_pct",
    "IFH%": "ifh_pct",
    "BUH%": "buh_pct",
    "Pull%": "pull_pct",
    "Cent%": "cent_pct",
    "Oppo%": "oppo_pct",
    "Soft%": "soft_pct",
    "Med%": "med_pct",
    "Hard%": "hard_pct",
    # Statcast (when merged from Statcast data)
    "xBA": "xba",
    "xSLG": "xslg",
    "xwOBA": "xwoba",
    "xOBP": "xobp",
    "Barrel%": "barrel_pct",
    "HardHit%": "hard_hit_pct",
    "EV": "avg_ev",
    "LA": "avg_la",
    "Sprint Speed": "sprint_speed",
    # Player ID fields — pybaseball returns "IDfg" as the FanGraphs player ID
    "IDfg": "fangraphs_id",
    "playerid": "fangraphs_id",  # legacy fallback
    "xMLBAMID": "mlbam_id",
}

PITCHING_COLUMN_MAP: dict[str, str] = {
    # Identity
    "Name": "name",
    "Team": "team",
    "Age": "age",
    "G": "g",
    "GS": "gs",
    "IP": "ip",
    # Traditional
    "W": "w",
    "L": "l",
    "SV": "sv",
    "BS": "bs",
    "HLD": "hld",
    "H": "h",
    "R": "r",
    "ER": "er",
    "HR": "hr",
    "BB": "bb",
    "IBB": "ibb",
    "HBP": "hbp",
    "SO": "so",
    "ERA": "era",
    "WHIP": "whip",
    # Advanced
    "WAR": "war",
    "FIP": "fip",
    "xFIP": "xfip",
    "SIERA": "siera",
    "ERA-": "era_minus",
    "FIP-": "fip_minus",
    "xFIP-": "xfip_minus",
    "WPA": "wpa",
    "RE24": "re24",
    "Clutch": "clutch",
    "pLI": "pli",
    # Rate Stats
    "K/9": "k_per_9",
    "BB/9": "bb_per_9",
    "K/BB": "k_bb_ratio",
    "HR/9": "hr_per_9",
    "H/9": "h_per_9",
    "K%": "k_pct",
    "BB%": "bb_pct",
    "K-BB%": "k_minus_bb_pct",
    "AVG": "avg_against",
    "BABIP": "babip",
    "LOB%": "lob_pct",
    # Batted Ball
    "GB%": "gb_pct",
    "FB%": "fb_pct",
    "LD%": "ld_pct",
    "IFFB%": "iffb_pct",
    "HR/FB": "hr_fb_pct",
    "IFH%": "ifh_pct",
    "Pull%": "pull_pct",
    "Cent%": "cent_pct",
    "Oppo%": "oppo_pct",
    "Soft%": "soft_pct",
    "Med%": "med_pct",
    "Hard%": "hard_pct",
    # Plate Discipline
    "O-Swing%": "o_swing_pct",
    "Z-Swing%": "z_swing_pct",
    "Swing%": "swing_pct",
    "O-Contact%": "o_contact_pct",
    "Z-Contact%": "z_contact_pct",
    "Contact%": "contact_pct",
    "Zone%": "zone_pct",
    "F-Strike%": "f_strike_pct",
    "SwStr%": "swstr_pct",
    "CStr%": "cstr_pct",
    "CSW%": "csw_pct",
    # Statcast / Stuff
    "Stuff+": "stuff_plus",
    "Location+": "location_plus",
    "Pitching+": "pitching_plus",
    "vFA (pi)": "avg_fastball_velo",
    "FA% (pi)": "fastball_pct",
    # Player ID fields — pybaseball returns "IDfg" as the FanGraphs player ID
    "IDfg": "fangraphs_id",
    "playerid": "fangraphs_id",  # legacy fallback
    "xMLBAMID": "mlbam_id",
}


def normalize_df(df, column_map: dict) -> "pd.DataFrame":
    """Rename columns per map, drop unmapped ones except ID columns."""
    import pandas as pd

    rename = {k: v for k, v in column_map.items() if k in df.columns}
    df = df.rename(columns=rename)
    # Keep only columns that were mapped
    keep = list(rename.values())
    existing = [c for c in keep if c in df.columns]
    return df[existing].copy()
