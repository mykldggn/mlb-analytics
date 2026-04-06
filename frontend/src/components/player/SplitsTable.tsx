import { formatStat } from '../../utils/formatters'

interface Split {
  split_name: string
  avg?: number
  obp?: number
  slg?: number
  ops?: number
  woba?: number
  hr?: number
  rbi?: number
  k_pct?: number
  bb_pct?: number
  pa?: number
}

interface Props { splits: Split[] }

const COLS = [
  { key: 'pa',    label: 'PA' },
  { key: 'avg',   label: 'AVG' },
  { key: 'obp',   label: 'OBP' },
  { key: 'slg',   label: 'SLG' },
  { key: 'ops',   label: 'OPS' },
  { key: 'hr',    label: 'HR' },
  { key: 'rbi',   label: 'RBI' },
  { key: 'k_pct', label: 'K%' },
  { key: 'bb_pct', label: 'BB%' },
]

export default function SplitsTable({ splits }: Props) {
  if (!splits.length) return <p className="text-gray-500 text-sm">No split data available.</p>
  const relevant = splits.filter(s =>
    ['vs Left', 'vs Right', 'vs LHP', 'vs RHP', 'Home', 'Away'].some(n =>
      s.split_name?.toLowerCase().includes(n.toLowerCase())
    )
  )
  const display = relevant.length ? relevant : splits.slice(0, 6)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-2 pr-4 text-gray-500 font-normal text-xs uppercase tracking-wide">Split</th>
            {COLS.map(c => (
              <th key={c.key} className="text-right py-2 px-2 text-gray-500 font-normal text-xs uppercase tracking-wide">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.map((split, i) => (
            <tr key={i} className="table-row-hover border-b border-gray-800/50">
              <td className="py-2 pr-4 text-gray-300 font-medium whitespace-nowrap">{split.split_name}</td>
              {COLS.map(c => (
                <td key={c.key} className="text-right py-2 px-2 font-mono text-gray-300">
                  {formatStat(c.key, (split as Record<string, unknown>)[c.key] as number)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
