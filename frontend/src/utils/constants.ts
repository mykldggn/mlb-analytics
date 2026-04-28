export const CURRENT_SEASON = 2025  // default for stats pages (last complete season)
export const LATEST_SEASON = 2026   // current calendar year (in-progress)
// FanGraphs data is available back to ~2002 (reliable advanced stats); Statcast back to 2015.
// Career WAR and traditional stats go back further via pybaseball.
export const SEASONS = [LATEST_SEASON, ...Array.from({ length: CURRENT_SEASON - 2001 }, (_, i) => CURRENT_SEASON - i)]
export const SEASONS_STATCAST = [LATEST_SEASON, ...Array.from({ length: CURRENT_SEASON - 2014 }, (_, i) => CURRENT_SEASON - i)]

export const BARREL_EV_THRESHOLD = 98
export const BARREL_LA_MIN = 8
export const BARREL_LA_MAX = 32
export const HARD_HIT_EV_THRESHOLD = 95

export const STAT_DEFINITIONS: Record<string, { label: string; description: string; unit?: string; lowerIsBetter?: boolean }> = {
  // Batting Advanced
  war:        { label: 'WAR',     description: 'Wins Above Replacement — total value vs league-average player' },
  wrc_plus:   { label: 'wRC+',    description: 'Weighted Runs Created Plus — overall offensive production, park/era adjusted. 100 = league avg.' },
  woba:       { label: 'wOBA',    description: 'Weighted On-Base Average — weights each offensive outcome by its run value.' },
  iso:        { label: 'ISO',     description: 'Isolated Power = SLG - AVG. Pure extra-base power.' },
  babip:      { label: 'BABIP',   description: 'Batting Avg on Balls In Play. League avg ≈ .300.' },
  ops_plus:   { label: 'OPS+',    description: 'OPS adjusted for park & era. 100 = league avg.' },
  wpa:        { label: 'WPA',     description: 'Win Probability Added — leverage-weighted contribution to wins.' },
  clutch:     { label: 'Clutch',  description: 'How much better/worse a player performs in high-leverage situations.' },
  bsr:        { label: 'BsR',     description: 'Base Running Runs above average.' },
  // Plate Discipline
  k_pct:        { label: 'K%',       description: 'Strikeout rate.',                     unit: '%', lowerIsBetter: true },
  bb_pct:       { label: 'BB%',      description: 'Walk rate.',                           unit: '%' },
  o_swing_pct:  { label: 'O-Swing%', description: 'Chase rate — swings at pitches outside the zone.', unit: '%', lowerIsBetter: true },
  z_swing_pct:  { label: 'Z-Swing%', description: 'Swing rate on pitches in the zone.',  unit: '%' },
  swstr_pct:    { label: 'SwStr%',   description: 'Swinging strike rate.',                unit: '%', lowerIsBetter: true },
  contact_pct:  { label: 'Contact%', description: 'Contact rate on all swings.',          unit: '%' },
  csw_pct:      { label: 'CSW%',     description: 'Called Strike + Whiff rate.',          unit: '%' },
  // Batted Ball
  gb_pct:    { label: 'GB%',   description: 'Ground ball rate.',    unit: '%' },
  fb_pct:    { label: 'FB%',   description: 'Fly ball rate.',       unit: '%' },
  ld_pct:    { label: 'LD%',   description: 'Line drive rate.',     unit: '%' },
  hr_fb_pct: { label: 'HR/FB', description: 'Home run to fly ball ratio.', unit: '%' },
  pull_pct:  { label: 'Pull%', description: 'Percentage of batted balls pulled.',   unit: '%' },
  cent_pct:  { label: 'Cent%', description: 'Percentage hit to center field.',      unit: '%' },
  oppo_pct:  { label: 'Oppo%', description: 'Percentage hit to opposite field.',    unit: '%' },
  hard_pct:  { label: 'Hard%', description: 'Hard-contact rate (FanGraphs).',       unit: '%' },
  // Statcast
  xba:          { label: 'xBA',       description: 'Expected Batting Average based on exit velocity & launch angle.' },
  xslg:         { label: 'xSLG',      description: 'Expected Slugging % based on exit velocity & launch angle.' },
  xwoba:        { label: 'xwOBA',     description: 'Expected wOBA from Statcast data.' },
  barrel_pct:   { label: 'Barrel%',   description: 'Barrel rate: EV ≥ 98 mph, LA 8–32°. Best contact outcomes.', unit: '%' },
  hard_hit_pct: { label: 'HardHit%',  description: 'Exit velocity ≥ 95 mph rate.',  unit: '%' },
  avg_ev:       { label: 'Avg EV',    description: 'Average exit velocity on all batted balls.', unit: ' mph' },
  avg_la:       { label: 'Avg LA',    description: 'Average launch angle.', unit: '°' },
  sprint_speed: { label: 'Sprint Spd', description: 'Sprint speed in ft/sec (top 1/3 of competitive runs).', unit: ' ft/s' },
  // Pitching Advanced
  era:          { label: 'ERA',      description: 'Earned Run Average.',                              lowerIsBetter: true },
  fip:          { label: 'FIP',      description: 'Fielding Independent Pitching — removes defense from ERA.', lowerIsBetter: true },
  xfip:         { label: 'xFIP',     description: 'Expected FIP — normalizes HR/FB to league average.', lowerIsBetter: true },
  siera:        { label: 'SIERA',    description: 'Skill-Interactive ERA — uses batted ball profile.',  lowerIsBetter: true },
  era_minus:    { label: 'ERA-',     description: 'ERA park/era adjusted, 100 = avg, lower is better.', lowerIsBetter: true },
  fip_minus:    { label: 'FIP-',     description: 'FIP adjusted, 100 = avg, lower is better.',          lowerIsBetter: true },
  whip:         { label: 'WHIP',     description: 'Walks + Hits per Inning Pitched.',                   lowerIsBetter: true },
  k_per_9:      { label: 'K/9',      description: 'Strikeouts per 9 innings.' },
  bb_per_9:     { label: 'BB/9',     description: 'Walks per 9 innings.',  lowerIsBetter: true },
  k_bb_ratio:   { label: 'K/BB',     description: 'Strikeout to walk ratio.' },
  lob_pct:      { label: 'LOB%',     description: 'Left-on-base rate. High = fortunate; regresses toward ~72%.' },
  stuff_plus:   { label: 'Stuff+',   description: 'Pitch quality from shape/velocity. 100 = avg pitcher.' },
  location_plus:{ label: 'Location+',description: 'Command/location quality. 100 = avg pitcher.' },
  pitching_plus:{ label: 'Pitching+',description: 'Combined Stuff+ and Location+. Overall pitch performance.' },
  // Park Factors
  batter_pfi:   { label: 'Batter PFI',  description: 'Park Favorability Index for hitters (0–200, 100 = neutral, >100 = hitter-friendly).' },
  pitcher_pfi:  { label: 'Pitcher PFI', description: 'Park Favorability Index for pitchers (0–200, 100 = neutral, >100 = pitcher-friendly).' },
}

export const POSITION_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'SP', 'RP', 'P']

export const MLB_TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  ARI: { primary: '#A71930', secondary: '#E3D4AD' },
  ATL: { primary: '#CE1141', secondary: '#13274F' },
  BAL: { primary: '#DF4601', secondary: '#000000' },
  BOS: { primary: '#BD3039', secondary: '#0C2340' },
  CHC: { primary: '#0E3386', secondary: '#CC3433' },
  CWS: { primary: '#27251F', secondary: '#C4CED4' },
  CIN: { primary: '#C6011F', secondary: '#000000' },
  CLE: { primary: '#00385D', secondary: '#E31937' },
  COL: { primary: '#33006F', secondary: '#C4CED4' },
  DET: { primary: '#0C2340', secondary: '#FA4616' },
  HOU: { primary: '#002D62', secondary: '#EB6E1F' },
  KC:  { primary: '#004687', secondary: '#C09A5B' },
  LAA: { primary: '#BA0021', secondary: '#003263' },
  LAD: { primary: '#005A9C', secondary: '#EF3E42' },
  MIA: { primary: '#00A3E0', secondary: '#EF3340' },
  MIL: { primary: '#12284B', secondary: '#FFC52F' },
  MIN: { primary: '#002B5C', secondary: '#D31145' },
  NYM: { primary: '#002D72', secondary: '#FF5910' },
  NYY: { primary: '#003087', secondary: '#E4002C' },
  OAK: { primary: '#003831', secondary: '#EFB21E' },
  PHI: { primary: '#E81828', secondary: '#002D72' },
  PIT: { primary: '#27251F', secondary: '#FDB827' },
  SD:  { primary: '#2F241D', secondary: '#FFC425' },
  SEA: { primary: '#0C2C56', secondary: '#005C5C' },
  SF:  { primary: '#FD5A1E', secondary: '#27251F' },
  STL: { primary: '#C41E3A', secondary: '#FEDB00' },
  TB:  { primary: '#092C5C', secondary: '#8FBCE6' },
  TEX: { primary: '#003278', secondary: '#C0111F' },
  TOR: { primary: '#134A8E', secondary: '#E8291C' },
  WSH: { primary: '#AB0003', secondary: '#14225A' },
}
