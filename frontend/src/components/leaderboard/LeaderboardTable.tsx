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
      <table className="w-full" style={{ fontSize: 13 }}>
        <thead style={{ background: '#f7f5f0' }}>
          <tr style={{ borderBottom: '1px solid var(--border2)' }}>
            <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', width: 32 }}>#</th>
            <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>Player</th>
            <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>Team</th>
            {visibleStats.map(k => {
              const def = STAT_DEFINITIONS[k]
              const isActive = sortBy === k
              return (
                <th
                  key={k}
                  onClick={() => onSort(k)}
                  style={{
                    textAlign: 'right',
                    padding: '10px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: isActive ? 'var(--accent2)' : 'var(--text3)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s',
                  }}
                >
                  <Tooltip content={def?.description}>
                    <span>
                      {def?.label ?? k.toUpperCase()}
                      {isActive && <span style={{ marginLeft: 3 }}>{order === 'desc' ? '↓' : '↑'}</span>}
                    </span>
                  </Tooltip>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((entry, i) => (
            <tr
              key={entry.mlbam_id ?? i}
              style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,25,80,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '8px', color: 'var(--text3)', fontSize: 12 }}>{rankOffset + i + 1}</td>
              <td style={{ padding: '8px' }}>
                <div className="flex items-center gap-2">
                  {entry.headshot_url && entry.mlbam_id && (
                    <img
                      src={entry.headshot_url}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                      style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
                    />
                  )}
                  {entry.mlbam_id ? (
                    <Link
                      to={`/players/${entry.mlbam_id}`}
                      style={{ color: 'var(--text)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent2)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
                    >
                      {entry.player_name}
                    </Link>
                  ) : (
                    <span style={{ color: 'var(--text)', whiteSpace: 'nowrap' }}>{entry.player_name}</span>
                  )}
                </div>
              </td>
              <td style={{ padding: '8px', color: 'var(--text3)', fontSize: 12 }}>{entry.team ?? '—'}</td>
              {visibleStats.map(k => (
                <td
                  key={k}
                  style={{
                    textAlign: 'right',
                    padding: '8px',
                    fontFamily: "'DM Mono', monospace",
                    color: sortBy === k ? 'var(--accent2)' : 'var(--text)',
                    fontSize: 12,
                  }}
                >
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
