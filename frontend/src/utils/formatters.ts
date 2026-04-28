export function formatAvg(val: number | null | undefined): string {
  if (val == null) return '—'
  return val.toFixed(3).replace(/^0/, '')
}

export function formatPct(val: number | null | undefined, alreadyPct = false): string {
  if (val == null) return '—'
  const n = alreadyPct ? val : val * 100
  return `${n.toFixed(1)}%`
}

export function formatDecimal(val: number | null | undefined, places = 2): string {
  if (val == null) return '—'
  return val.toFixed(places)
}

export function formatIP(val: number | null | undefined): string {
  if (val == null) return '—'
  const whole = Math.floor(val)
  const frac = Math.round((val - whole) * 3)
  return frac === 0 ? `${whole}.0` : `${whole}.${frac}`
}

export function formatERA(val: number | null | undefined): string {
  return formatDecimal(val, 2)
}

export function formatWAR(val: number | null | undefined): string {
  if (val == null) return '—'
  return val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1)
}

export function formatEV(val: number | null | undefined): string {
  if (val == null) return '—'
  return `${val.toFixed(1)} mph`
}

export function formatPFI(val: number | null | undefined): string {
  if (val == null) return '—'
  return val.toFixed(1)
}

export function formatStat(statKey: string, value: number | null | undefined): string {
  if (value == null) return '—'
  // Savant stats arrive already in percentage form (e.g. 23.5 means 23.5%) — pass alreadyPct=true
  const alreadyPctStats = new Set(['barrel_pct', 'hard_hit_pct'])
  // FanGraphs/computed stats are stored as decimals (e.g. 0.247 means 24.7%) — multiply by 100
  const pctStats = new Set([
    'k_pct', 'bb_pct', 'k_minus_bb_pct',
    'o_swing_pct', 'z_swing_pct', 'swing_pct', 'o_contact_pct',
    'z_contact_pct', 'contact_pct', 'zone_pct', 'f_strike_pct', 'swstr_pct', 'csw_pct',
    'gb_pct', 'fb_pct', 'ld_pct', 'iffb_pct', 'hr_fb_pct', 'pull_pct', 'cent_pct',
    'oppo_pct', 'hard_pct', 'soft_pct', 'med_pct', 'lob_pct',
  ])
  const avgStats = new Set(['avg', 'obp', 'slg', 'ops', 'woba', 'xba', 'xwoba', 'xslg', 'xobp', 'babip', 'avg_against'])
  const warStats = new Set(['war', 'wpa', 'wraa', 're24'])
  const eraStats = new Set(['era', 'fip', 'xfip', 'siera', 'whip', 'era_minus', 'fip_minus', 'xfip_minus'])
  const evStats  = new Set(['avg_ev', 'max_ev'])

  if (alreadyPctStats.has(statKey)) return formatPct(value, true)
  if (pctStats.has(statKey)) return formatPct(value, false)
  if (avgStats.has(statKey)) return formatAvg(value)
  if (warStats.has(statKey)) return formatWAR(value)
  if (eraStats.has(statKey)) return formatERA(value)
  if (evStats.has(statKey))  return formatEV(value)
  if (statKey === 'ip')      return formatIP(value)
  if (statKey === 'avg_la')  return `${value.toFixed(1)}°`
  if (statKey === 'sprint_speed') return `${value.toFixed(1)} ft/s`
  if (statKey === 'batter_pfi' || statKey === 'pitcher_pfi') return formatPFI(value)
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(1)
}
