import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { get } from '../api/client'
import LoadingSpinner from '../components/ui/LoadingSpinner'

// Extended salary data through 2024; fall back to 2016 if network fetch fails
const DEFAULT_MAX_YEAR = 2024
const SEASONS = Array.from({ length: DEFAULT_MAX_YEAR - 1985 + 1 }, (_, i) => DEFAULT_MAX_YEAR - i)

interface ContractPlayer {
  name: string
  team?: string
  mlbam_id?: number
  salary: number
  war: number
  dollars_per_war?: number
  war_per_million?: number
  headshot_url?: string
}

interface ContractResponse {
  season: number
  data_available: boolean
  message?: string
  max_year?: number
  total_players?: number
  best_value?: ContractPlayer[]
  worst_value?: ContractPlayer[]
}

function formatSalary(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function ValueBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

function PlayerTable({
  players, label, valueKey, color,
}: {
  players: ContractPlayer[]
  label: string
  valueKey: 'war_per_million' | 'dollars_per_war'
  valueLabel: string
  higherIsBetter: boolean
  color: string
}) {
  const vals = players.map(p => p[valueKey] as number).filter(Boolean)
  const maxVal = Math.max(...vals, 1)

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-200 mb-3">{label}</h3>
      <div className="space-y-1">
        {players.map((p, i) => (
          <div key={p.name + i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-800/50 transition-colors">
            <span className="text-gray-600 text-xs w-5 text-right shrink-0">{i + 1}</span>
            {p.headshot_url && p.mlbam_id && (
              <img src={p.headshot_url} alt="" className="w-6 h-6 rounded-full bg-gray-700 shrink-0 object-cover" />
            )}
            <div className="flex-1 min-w-0">
              {p.mlbam_id ? (
                <Link to={`/players/${p.mlbam_id}`} className="text-sm text-gray-200 hover:text-blue-400 transition-colors truncate block">
                  {p.name}
                </Link>
              ) : (
                <span className="text-sm text-gray-200 truncate block">{p.name}</span>
              )}
              <span className="text-xs text-gray-500">{(p.team && p.team !== '---') ? p.team : 'Multi-team'} · {formatSalary(p.salary)}</span>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-sm text-gray-200">
                {valueKey === 'war_per_million'
                  ? `${(p.war_per_million ?? 0).toFixed(1)} WAR/$M`
                  : `$${((p.dollars_per_war ?? 0) / 1_000_000).toFixed(1)}M/WAR`
                }
              </div>
              <div className="text-xs text-gray-500">WAR: {p.war.toFixed(1)}</div>
            </div>
            <ValueBar value={p[valueKey] as number ?? 0} max={maxVal} color={color} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ContractValuePage() {
  const [season, setSeason] = useState(DEFAULT_MAX_YEAR)
  const [group, setGroup] = useState<'batting' | 'pitching'>('batting')

  const { data, isLoading } = useQuery<ContractResponse>({
    queryKey: ['contract-value', season, group],
    queryFn: () => get(`/contract-value/${season}`, { group, min_pa: 100, min_ip: 40 }),
    staleTime: 60 * 60 * 1000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)' }}>Contract Value</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-2xl">
            WAR per salary dollar — who earned their contract and who was overpaid?
            Salary data from the Lahman database{data?.max_year ? ` (available through ${data.max_year})` : ''}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', borderRadius: 8, padding: 4 }}>
            {(['batting', 'pitching'] as const).map(g => (
              <button key={g} onClick={() => setGroup(g)}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  background: group === g ? 'var(--accent2)' : 'transparent',
                  color: group === g ? 'white' : 'var(--text2)',
                  border: 'none', textTransform: 'capitalize',
                }}
              >{g}</button>
            ))}
          </div>
          <select
            value={season}
            onChange={e => setSeason(Number(e.target.value))}
            style={{ background: 'white', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
          >
            {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading contract data..." />
      ) : !data?.data_available ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">💰</div>
          <p className="text-gray-400">{data?.message ?? 'Salary data unavailable.'}</p>
          {data?.max_year && (
            <button
              onClick={() => setSeason(data.max_year!)}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              View {data.max_year} (latest available)
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="card" style={{ borderColor: 'rgba(0,31,91,0.14)', background: 'rgba(0,31,91,0.04)' }}>
            <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text2)' }}>
              <span className="text-blue-400 text-lg">📊</span>
              <span>
                <span className="text-gray-200 font-medium">{data.total_players} players</span> matched between
                Lahman salary data and FanGraphs WAR for {season} {group}.
                Ranked by WAR per $1M of salary (best value) and $/WAR (worst value).
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Best value */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-emerald-400 text-lg">🏆</span>
                <h2 className="text-base font-semibold text-gray-100">Best Value</h2>
                <span className="text-xs text-gray-500">Highest WAR per $1M salary</span>
              </div>
              <PlayerTable
                players={data.best_value ?? []}
                label=""
                valueKey="war_per_million"
                valueLabel="WAR/$M"
                higherIsBetter
                color="#34d399"
              />
            </div>

            {/* Worst value */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-red-400 text-lg">💸</span>
                <h2 className="text-base font-semibold text-gray-100">Most Expensive</h2>
                <span className="text-xs text-gray-500">Highest $ per WAR</span>
              </div>
              <PlayerTable
                players={data.worst_value ?? []}
                label=""
                valueKey="dollars_per_war"
                valueLabel="$/WAR"
                higherIsBetter={false}
                color="#f87171"
              />
            </div>
          </div>

          {/* Methodology */}
          <div className="card border-gray-800 bg-gray-900/40">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Methodology</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Salary data from the Lahman Baseball Database (public domain, extended through 2024 by community contributors). WAR from FanGraphs via pybaseball.
              Players are matched using the Chadwick Bureau cross-reference register.
              <span className="text-gray-300"> Best value</span> = highest WAR earned per $1M of salary.
              <span className="text-gray-300"> Most expensive</span> = highest dollars spent per win above replacement.
              Minimum thresholds applied ({group === 'batting' ? '100 PA' : '40 IP'}) to filter small samples.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
