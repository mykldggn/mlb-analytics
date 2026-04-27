import { Link } from 'react-router-dom'
import { formatStat } from '../../utils/formatters'
import { STAT_DEFINITIONS } from '../../utils/constants'
import Tooltip from '../ui/Tooltip'

// MLBAM team IDs → used for logo URLs
const TEAM_IDS: Record<string, number> = {
  ARI: 109, AZ: 109,
  ATL: 144,
  BAL: 110,
  BOS: 111,
  CHC: 112,
  CWS: 145, CHW: 145,
  CIN: 113,
  CLE: 114,
  COL: 115,
  DET: 116,
  HOU: 117,
  KCR: 118, KC: 118,
  LAA: 108,
  LAD: 119,
  MIA: 146,
  MIL: 158,
  MIN: 142,
  NYM: 121,
  NYY: 147,
  OAK: 133, ATH: 133,
  PHI: 143,
  PIT: 134,
  SDP: 135, SD: 135,
  SFG: 137, SF: 137,
  SEA: 136,
  STL: 138,
  TBR: 139, TB: 139,
  TEX: 140,
  TOR: 141,
  WSN: 120, WAS: 120, WSH: 120,
}

function TeamLogo({ abbrev }: { abbrev: string }) {
  const id = TEAM_IDS[abbrev?.toUpperCase()]
  if (!id) return <span style={{ fontSize: 11, color: 'var(--text3)' }}>{abbrev}</span>
  return (
    <img
      src={`https://midfield.mlbstatic.com/v1/team/${id}/spots/88`}
      alt={abbrev}
      title={abbrev}
      width={28}
      height={28}
      style={{ objectFit: 'contain', display: 'block' }}
      onError={e => {
        const el = e.currentTarget
        el.style.display = 'none'
        if (el.nextSibling) (el.nextSibling as HTMLElement).style.display = 'inline'
      }}
    />
  )
}

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
          {data.map((entry, i) => {
            const rank = rankOffset + i + 1
            const accentColor = rank === 1 ? '#b8922a' : rank === 2 ? '#8a9ba8' : rank === 3 ? '#a0673a' : 'transparent'
            return (
            <tr
              key={entry.mlbam_id ?? i}
              style={{
                borderBottom: '1px solid var(--border)',
                borderLeft: `3px solid ${accentColor}`,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,25,80,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '8px', color: 'var(--text3)', fontSize: 12 }}>{rank}</td>
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
              <td style={{ padding: '8px 10px' }}>
                <TeamLogo abbrev={entry.team ?? ''} />
                <span style={{ display: 'none', fontSize: 11, color: 'var(--text3)' }}>{entry.team}</span>
              </td>
              {visibleStats.map(k => (
                <td
                  key={k}
                  style={{
                    textAlign: 'right',
                    padding: '8px',
                    fontFamily: "'DM Mono', monospace",
                    color: sortBy === k ? 'var(--accent2)' : 'var(--text)',
                    fontSize: 12,
                    background: sortBy === k ? 'rgba(0,31,91,0.03)' : 'transparent',
                  }}
                >
                  {formatStat(k, entry.stats[k] as number)}
                </td>
              ))}
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
