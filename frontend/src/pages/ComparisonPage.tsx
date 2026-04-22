import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { searchPlayers, PlayerSearchResult } from '../api/search'
import { useDebounce } from '../hooks/useDebounce'
import { CURRENT_SEASON, SEASONS, STAT_DEFINITIONS } from '../utils/constants'
import { formatStat } from '../utils/formatters'
import RadarChart from '../components/charts/RadarChart'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { get } from '../api/client'

const RADAR_STATS_BATTING  = ['war', 'wrc_plus', 'k_pct', 'bb_pct', 'barrel_pct', 'iso', 'babip', 'woba']
const RADAR_STATS_PITCHING = ['war', 'fip', 'k_per_9', 'bb_per_9', 'swstr_pct', 'csw_pct', 'stuff_plus', 'era']

const PLAYER_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b']

interface PlayerSlot {
  player: PlayerSearchResult
  season: number
}

export default function ComparisonPage() {
  const [slots, setSlots] = useState<PlayerSlot[]>([])
  const [mode, setMode] = useState<'batting' | 'pitching'>('batting')

  const addPlayer = (p: PlayerSearchResult) => {
    if (slots.length >= 4 || slots.some(s => s.player.mlbam_id === p.mlbam_id)) return
    setSlots(prev => [...prev, { player: p, season: CURRENT_SEASON }])
  }
  const removePlayer = (id: number) => setSlots(prev => prev.filter(s => s.player.mlbam_id !== id))
  const updateSeason = (id: number, season: number) =>
    setSlots(prev => prev.map(s => s.player.mlbam_id === id ? { ...s, season } : s))

  return (
    <div className="space-y-6">
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)' }}>Player Comparison</h1>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {(['batting', 'pitching'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              transition: 'background 0.15s, color 0.15s', textTransform: 'capitalize',
              background: mode === m ? 'var(--accent2)' : 'var(--surface)',
              color: mode === m ? 'white' : 'var(--text2)',
              border: mode === m ? 'none' : '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >{m}</button>
        ))}
      </div>

      {/* Player slots */}
      <div className="flex flex-wrap gap-3">
        {slots.map((slot, i) => (
          <div key={slot.player.mlbam_id} className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: 'white', border: `1px solid ${PLAYER_COLORS[i]}60` }}>
            <img src={slot.player.headshot_url} alt={slot.player.fullName} className="w-7 h-7 rounded-full bg-gray-700" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-gray-200 leading-none">{slot.player.fullName}</span>
              <select
                value={slot.season}
                onChange={e => updateSeason(slot.player.mlbam_id, Number(e.target.value))}
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11, color: 'var(--text2)', padding: '1px 4px', outline: 'none' }}
              >
                {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={() => removePlayer(slot.player.mlbam_id)} className="text-gray-600 hover:text-gray-400 ml-1">×</button>
          </div>
        ))}
        {slots.length < 4 && <PlayerSearchInput onSelect={addPlayer} />}
      </div>

      {slots.length === 0 ? (
        <div className="card text-center py-16 space-y-3">
          <div className="text-5xl">⚾</div>
          <p className="text-gray-300 font-medium">Compare up to 4 players side-by-side</p>
          <p className="text-gray-500 text-sm">Search for a player above to get started ↑</p>
          <p className="text-gray-600 text-xs mt-2">Includes radar charts, percentile bars, and stat tables across any season</p>
        </div>
      ) : slots.length < 2 ? (
        <div className="card text-center py-10 text-gray-500">
          <p className="text-gray-400">Add one more player to start comparing.</p>
          <p className="text-gray-600 text-sm mt-1">Search for another player above ↑</p>
        </div>
      ) : (
        <ComparisonResults slots={slots} mode={mode} />
      )}
    </div>
  )
}

function ComparisonResults({ slots, mode }: { slots: PlayerSlot[]; mode: 'batting' | 'pitching' }) {
  // Always call exactly 4 useQuery hooks (disabled when slot doesn't exist)
  const s0 = slots[0], s1 = slots[1], s2 = slots[2], s3 = slots[3]

  const q0 = useQuery({
    queryKey: ['cmp', mode, s0?.player.mlbam_id, s0?.season],
    queryFn: () => get<{ players: Array<{ mlbam_id: number; stats: Record<string, unknown> }> }>(
      `/comparison/${mode}?player_ids=${s0!.player.mlbam_id}&season=${s0!.season}`),
    enabled: !!s0,
  })
  const q1 = useQuery({
    queryKey: ['cmp', mode, s1?.player.mlbam_id, s1?.season],
    queryFn: () => get<{ players: Array<{ mlbam_id: number; stats: Record<string, unknown> }> }>(
      `/comparison/${mode}?player_ids=${s1!.player.mlbam_id}&season=${s1!.season}`),
    enabled: !!s1,
  })
  const q2 = useQuery({
    queryKey: ['cmp', mode, s2?.player.mlbam_id, s2?.season],
    queryFn: () => get<{ players: Array<{ mlbam_id: number; stats: Record<string, unknown> }> }>(
      `/comparison/${mode}?player_ids=${s2!.player.mlbam_id}&season=${s2!.season}`),
    enabled: !!s2,
  })
  const q3 = useQuery({
    queryKey: ['cmp', mode, s3?.player.mlbam_id, s3?.season],
    queryFn: () => get<{ players: Array<{ mlbam_id: number; stats: Record<string, unknown> }> }>(
      `/comparison/${mode}?player_ids=${s3!.player.mlbam_id}&season=${s3!.season}`),
    enabled: !!s3,
  })
  const p0 = useQuery({
    queryKey: ['cmp-pct', mode, s0?.player.mlbam_id, s0?.season],
    queryFn: () => get<{ players: Array<{ mlbam_id: number; percentiles: Record<string, number> }> }>(
      `/comparison/percentiles?player_ids=${s0!.player.mlbam_id}&season=${s0!.season}&group=${mode}`),
    enabled: !!s0,
  })
  const p1 = useQuery({
    queryKey: ['cmp-pct', mode, s1?.player.mlbam_id, s1?.season],
    queryFn: () => get<{ players: Array<{ mlbam_id: number; percentiles: Record<string, number> }> }>(
      `/comparison/percentiles?player_ids=${s1!.player.mlbam_id}&season=${s1!.season}&group=${mode}`),
    enabled: !!s1,
  })
  const p2 = useQuery({
    queryKey: ['cmp-pct', mode, s2?.player.mlbam_id, s2?.season],
    queryFn: () => get<{ players: Array<{ mlbam_id: number; percentiles: Record<string, number> }> }>(
      `/comparison/percentiles?player_ids=${s2!.player.mlbam_id}&season=${s2!.season}&group=${mode}`),
    enabled: !!s2,
  })
  const p3 = useQuery({
    queryKey: ['cmp-pct', mode, s3?.player.mlbam_id, s3?.season],
    queryFn: () => get<{ players: Array<{ mlbam_id: number; percentiles: Record<string, number> }> }>(
      `/comparison/percentiles?player_ids=${s3!.player.mlbam_id}&season=${s3!.season}&group=${mode}`),
    enabled: !!s3,
  })

  const queries = [q0, q1, q2, q3].slice(0, slots.length)
  const percentileQueries = [p0, p1, p2, p3].slice(0, slots.length)
  const isLoading = queries.some(q => q.isLoading)

  const tableStats = mode === 'batting'
    ? ['war', 'wrc_plus', 'woba', 'ops', 'avg', 'hr', 'rbi', 'sb', 'k_pct', 'bb_pct', 'babip', 'iso', 'xba', 'xslg', 'barrel_pct', 'avg_ev']
    : ['war', 'era', 'fip', 'xfip', 'siera', 'k_per_9', 'bb_per_9', 'k_bb_ratio', 'whip', 'k_pct', 'swstr_pct', 'csw_pct', 'stuff_plus']

  const radarStats = mode === 'batting' ? RADAR_STATS_BATTING : RADAR_STATS_PITCHING
  const lowerIsBetter = new Set(['fip', 'era', 'bb_per_9', 'k_pct'])

  // Build per-player stats map
  const playerStats: Record<number, Record<string, unknown>> = {}
  const playerPercentiles: Record<number, Record<string, number>> = {}

  slots.forEach((slot, i) => {
    const statsResult = queries[i].data?.players?.[0]
    if (statsResult) playerStats[slot.player.mlbam_id] = statsResult.stats
    const pctResult = percentileQueries[i].data?.players?.[0]
    if (pctResult) playerPercentiles[slot.player.mlbam_id] = pctResult.percentiles
  })

  const radarSeries = slots.map((slot, i) => ({
    label: `${slot.player.fullName.split(' ').slice(-1)[0]} '${String(slot.season).slice(2)}`,
    color: PLAYER_COLORS[i],
    data: radarStats.map(k => ({
      key: k,
      label: STAT_DEFINITIONS[k]?.label ?? k.toUpperCase(),
      percentile: playerPercentiles[slot.player.mlbam_id]?.[k] ?? 50,
    })),
  }))

  if (isLoading) return <LoadingSpinner label="Loading comparison..." />

  return (
    <div className="space-y-6">
      {/* Radar chart */}
      {radarSeries.length >= 2 && (
        <div className="card">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Percentile Radar</h3>
          <RadarChart series={radarSeries} />
        </div>
      )}

      {/* Stat table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-2 text-gray-500 font-normal text-xs uppercase tracking-wide">Stat</th>
              {slots.map((slot, i) => (
                <th key={slot.player.mlbam_id} className="text-right py-2 px-3">
                  <Link to={`/players/${slot.player.mlbam_id}`} className="text-sm font-medium hover:text-blue-400 transition-colors"
                    style={{ color: PLAYER_COLORS[i] }}>
                    {slot.player.fullName.split(' ').slice(-1)[0]}
                  </Link>
                  <div className="text-xs font-normal text-gray-600">{slot.season}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableStats.map(k => {
              const def = STAT_DEFINITIONS[k]
              const row = slots.map(slot => ({
                id: slot.player.mlbam_id,
                val: playerStats[slot.player.mlbam_id]?.[k] as number | null,
              }))
              const vals = row.map(r => r.val).filter((v): v is number => v != null)
              const best = vals.length > 1 ? (lowerIsBetter.has(k) ? Math.min(...vals) : Math.max(...vals)) : null
              return (
                <tr key={k} className="table-row-hover border-b border-gray-800/40">
                  <td className="py-1.5 px-2 text-gray-500 text-xs">{def?.label ?? k.toUpperCase()}</td>
                  {row.map((r) => (
                    <td key={r.id} className={`text-right py-1.5 px-3 font-mono text-sm ${r.val != null && r.val === best ? 'text-emerald-400 font-semibold' : 'text-gray-300'}`}>
                      {formatStat(k, r.val)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlayerSearchInput({ onSelect }: { onSelect: (p: PlayerSearchResult) => void }) {
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 300)
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    queryKey: ['search', dq],
    queryFn: () => searchPlayers(dq),
    enabled: dq.length >= 2,
  })
  return (
    <div className="relative">
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        placeholder="Add player..."
        className="bg-gray-800 border border-gray-700 border-dashed rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-44"
      />
      {open && data && data.length > 0 && (
        <div className="absolute top-full mt-1 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
          {data.map(p => (
            <button key={p.mlbam_id} onClick={() => { onSelect(p); setQ(''); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-800 transition-colors text-left">
              <img src={p.headshot_url} alt="" className="w-7 h-7 rounded-full bg-gray-700" />
              <div>
                <div className="text-sm text-gray-200">{p.fullName}</div>
                <div className="text-xs text-gray-500">{p.position} · {p.team || (p.active === false ? 'Retired' : '')}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
