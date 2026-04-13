import { Link } from 'react-router-dom'
import { formatStat } from '../../utils/formatters'
import { STAT_DEFINITIONS } from '../../utils/constants'
import Tooltip from '../ui/Tooltip'

interface Entry {
  mlbam_id?: number
  player_name: string
  team?: string
  headshot_url?: string
  stats: Record<string, unknown>
}

interface Props {
  data: Entry[]
  visibleStats: string[]
  sortBy: string
  order: 'asc' | 'desc'
  onSort: (key: string) => void
  rankOffset?: number
}

export default function LeaderboardTable({ data, visibleStats, sortBy, order, onSort, rankOffset = 0 }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-900/95 backdrop-blur z-10">
          <tr className="border-b border-gray-700">
            <th className="text-left py-3 px-2 text-gray-500 font-normal text-xs uppercase tracking-wide w-8">#</th>
            <th className="text-left py-3 px-2 text-gray-500 font-normal text-xs uppercase tracking-wide">Player</th>
            <th className="text-left py-3 px-2 text-gray-500 font-normal text-xs uppercase tracking-wide">Team</th>
            {visibleStats.map(k => {
              const def = STAT_DEFINITIONS[k]
              return (
                <th
                  key={k}
                  onClick={() => onSort(k)}
                  className={`text-right py-3 px-2 text-xs uppercase tracking-wide font-normal cursor-pointer transition-colors select-none ${
                    sortBy === k ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Tooltip content={def?.description}>
                    <span>
                      {def?.label ?? k.toUpperCase()}
                      {sortBy === k && <span className="ml-1">{order === 'desc' ? '↓' : '↑'}</span>}
                    </span>
                  </Tooltip>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((entry, i) => (
            <tr key={entry.mlbam_id ?? i} className="table-row-hover border-b border-gray-800/50">
              <td className="py-2 px-2 text-gray-600 text-xs">{rankOffset + i + 1}</td>
              <td className="py-2 px-2">
                <div className="flex items-center gap-2">
                  {entry.headshot_url && entry.mlbam_id && (
                    <img src={entry.headshot_url} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-800 shrink-0" />
                  )}
                  {entry.mlbam_id ? (
                    <Link to={`/players/${entry.mlbam_id}`} className="text-gray-200 hover:text-blue-400 transition-colors whitespace-nowrap">
                      {entry.player_name}
                    </Link>
                  ) : (
                    <span className="text-gray-200">{entry.player_name}</span>
                  )}
                </div>
              </td>
              <td className="py-2 px-2 text-gray-500 text-xs">{entry.team ?? '—'}</td>
              {visibleStats.map(k => (
                <td key={k} className="text-right py-2 px-2 font-mono text-gray-300">
                  {formatStat(k, entry.stats[k] as number)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
