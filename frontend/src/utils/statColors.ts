/**
 * Returns a Tailwind CSS text color class based on percentile rank.
 * Stats where lower is better have the scale inverted before calling this.
 */
export function percentileToClass(percentile: number): string {
  if (percentile >= 90) return 'stat-elite'
  if (percentile >= 75) return 'stat-great'
  if (percentile >= 60) return 'stat-above'
  if (percentile >= 40) return 'stat-avg'
  if (percentile >= 25) return 'stat-below'
  return 'stat-poor'
}

export function percentileToHex(percentile: number): string {
  // Red (0%) → Yellow (50%) → Green (100%)
  if (percentile >= 80) return '#34d399'  // emerald-400
  if (percentile >= 65) return '#4ade80'  // green-400
  if (percentile >= 55) return '#86efac'  // green-300
  if (percentile >= 45) return '#d1d5db'  // gray-300
  if (percentile >= 35) return '#fbbf24'  // amber-400
  if (percentile >= 20) return '#f87171'  // red-400
  return '#ef4444'                         // red-500
}

// Stats that should never be color-coded (counting stats)
export const NEUTRAL_STATS = new Set(['pa', 'ab', 'g', 'gs', 'ip', 'h', 'r', 'hr', 'rbi', 'sb', 'bb', 'so', 'w', 'l', 'sv', 'hld'])
