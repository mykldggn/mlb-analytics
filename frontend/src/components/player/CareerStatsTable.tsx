import { formatStat } from '../../utils/formatters'

type Row = Record<string, unknown>

const BATTING_COLS = [
  { key: 'season', label: 'Year' },
  { key: 'g', label: 'G' },
  { key: 'pa', label: 'PA' },
  { key: 'hr', label: 'HR' },
  { key: 'rbi', label: 'RBI' },
  { key: 'sb', label: 'SB' },
  { key: 'avg', label: 'AVG' },
  { key: 'obp', label: 'OBP' },
  { key: 'slg', label: 'SLG' },
  { key: 'ops', label: 'OPS' },
  { key: 'wrc_plus', label: 'wRC+' },
  { key: 'woba', label: 'wOBA' },
  { key: 'iso', label: 'ISO' },
  { key: 'babip', label: 'BABIP' },
  { key: 'k_pct', label: 'K%' },
  { key: 'bb_pct', label: 'BB%' },
  { key: 'war', label: 'WAR' },
]

const PITCHING_COLS = [
  { key: 'season', label: 'Year' },
  { key: 'g', label: 'G' },
  { key: 'gs', label: 'GS' },
  { key: 'ip', label: 'IP' },
  { key: 'w', label: 'W' },
  { key: 'l', label: 'L' },
  { key: 'sv', label: 'SV' },
  { key: 'era', label: 'ERA' },
  { key: 'fip', label: 'FIP' },
  { key: 'xfip', label: 'xFIP' },
  { key: 'whip', label: 'WHIP' },
  { key: 'k_per_9', label: 'K/9' },
  { key: 'bb_per_9', label: 'BB/9' },
  { key: 'k_pct', label: 'K%' },
  { key: 'bb_pct', label: 'BB%' },
  { key: 'gb_pct', label: 'GB%' },
  { key: 'war', label: 'WAR' },
]

// Rate stats that should show weighted averages instead of sums
const BATTING_RATE_STATS = new Set(['avg', 'obp', 'slg', 'ops', 'wrc_plus', 'woba', 'iso', 'babip', 'k_pct', 'bb_pct'])
const PITCHING_RATE_STATS = new Set(['era', 'fip', 'xfip', 'whip', 'k_per_9', 'bb_per_9', 'k_pct', 'bb_pct', 'gb_pct'])

interface Props {
  yearByYear: Row[]
  careerTotals: Row
  isPitcher?: boolean
}

function fmtCell(key: string, val: unknown): string {
  if (val == null) return '—'
  if (key === 'season') return String(val)
  if (key === 'ip') return Number(val).toFixed(1)
  return formatStat(key, val as number)
}

function computeWeightedAverages(rows: Row[], isPitcher: boolean): Row {
  const rateStats = isPitcher ? PITCHING_RATE_STATS : BATTING_RATE_STATS
  const weightKey = isPitcher ? 'ip' : 'pa'
  const result: Row = {}

  let totalWeight = 0
  for (const row of rows) {
    const w = Number(row[weightKey] ?? 0)
    if (w > 0) totalWeight += w
  }
  if (totalWeight === 0) return result

  for (const stat of rateStats) {
    let weightedSum = 0
    let usedWeight = 0
    for (const row of rows) {
      const val = row[stat]
      const w = Number(row[weightKey] ?? 0)
      if (val != null && !isNaN(Number(val)) && w > 0) {
        weightedSum += Number(val) * w
        usedWeight += w
      }
    }
    if (usedWeight > 0) {
      result[stat] = weightedSum / usedWeight
    }
  }
  return result
}

export default function CareerStatsTable({ yearByYear, careerTotals, isPitcher = false }: Props) {
  const cols = isPitcher ? PITCHING_COLS : BATTING_COLS

  // Only show columns that have at least one non-null value across all rows
  const activeCols = cols.filter(col =>
    col.key === 'season' ||
    yearByYear.some(r => r[col.key] != null) ||
    careerTotals[col.key] != null
  )

  const sorted = [...yearByYear].sort((a, b) => {
    const aS = Number(a.season ?? 0)
    const bS = Number(b.season ?? 0)
    return aS - bS
  })

  const rateStats = isPitcher ? PITCHING_RATE_STATS : BATTING_RATE_STATS
  const weightedAvgs = computeWeightedAverages(sorted, isPitcher)

  // Build the career totals row: use weighted avg for rate stats, backend total for cumulative stats
  const careerRow: Row = { ...careerTotals }
  for (const stat of rateStats) {
    if (weightedAvgs[stat] != null) {
      careerRow[stat] = weightedAvgs[stat]
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-gray-900 text-gray-500 text-xs uppercase tracking-wider">
            {activeCols.map(col => (
              <th key={col.key} className="px-3 py-2 whitespace-nowrap font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {sorted.map((row, i) => (
            <tr key={i} className="hover:bg-gray-800/50 transition-colors">
              {activeCols.map(col => (
                <td
                  key={col.key}
                  className={`px-3 py-2 whitespace-nowrap font-mono ${col.key === 'season' ? 'text-gray-300 font-semibold' : 'text-gray-400'}`}
                >
                  {fmtCell(col.key, row[col.key])}
                </td>
              ))}
            </tr>
          ))}
          {/* Career totals row with weighted rate stat averages */}
          {Object.keys(careerTotals).length > 0 && (
            <tr className="bg-gray-800 font-semibold border-t-2 border-gray-600">
              {activeCols.map(col => (
                <td
                  key={col.key}
                  className={`px-3 py-2 whitespace-nowrap font-mono ${col.key === 'season' ? 'text-blue-400' : 'text-gray-200'}`}
                >
                  {col.key === 'season'
                    ? 'Career'
                    : rateStats.has(col.key)
                      ? fmtCell(col.key, careerRow[col.key])
                      : fmtCell(col.key, careerTotals[col.key])}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-8">No career data available.</p>
      )}
    </div>
  )
}
