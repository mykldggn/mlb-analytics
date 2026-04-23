import { useState } from 'react'
import { useBattingLeaderboard, usePitchingLeaderboard } from '../hooks/useLeaderboard'
import LeaderboardTable from '../components/leaderboard/LeaderboardTable'
import LeaderboardFilters from '../components/leaderboard/LeaderboardFilters'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import TabGroup from '../components/ui/TabGroup'
import { CURRENT_SEASON, STAT_DEFINITIONS } from '../utils/constants'
import { post } from '../api/client'

const BATTING_VISIBLE  = ['war', 'wrc_plus', 'woba', 'ops', 'avg', 'hr', 'rbi', 'sb', 'k_pct', 'bb_pct', 'babip', 'iso', 'xba', 'xslg', 'barrel_pct']
const PITCHING_VISIBLE = ['war', 'era', 'fip', 'fip_minus', 'era_minus', 'k_per_9', 'bb_per_9', 'k_bb_ratio', 'k_minus_bb_pct', 'whip', 'k_pct', 'bb_pct', 'lob_pct', 'babip']

const PAGE_TABS = [
  { key: 'batting', label: 'Batting' },
  { key: 'pitching', label: 'Pitching' },
]

export default function LeaderboardPage() {
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'batting' | 'pitching'>('batting')
  const [warmupState, setWarmupState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [warmupResult, setWarmupResult] = useState<{ triggered: number; already_cached: number } | null>(null)
  const glossaryStats = activeTab === 'batting' ? BATTING_VISIBLE : PITCHING_VISIBLE

  async function handleWarmup() {
    setWarmupState('loading')
    try {
      const result = await post(`/jobs/warmup-statcast?season=${CURRENT_SEASON}&top_n=100`) as { triggered: number; already_cached: number }
      setWarmupResult(result)
      setWarmupState('done')
    } catch {
      setWarmupState('idle')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)' }}>Leaderboards</h1>
        <div className="flex items-center gap-3">
          {warmupState === 'done' && warmupResult ? (
            <span style={{ fontSize: 11, color: '#059669' }}>
              Statcast: {warmupResult.triggered} queued, {warmupResult.already_cached} already cached
            </span>
          ) : warmupState === 'loading' ? (
            <span style={{ fontSize: 11, color: 'var(--accent2)' }}>Queuing Statcast jobs...</span>
          ) : (
            <button
              onClick={handleWarmup}
              title="Pre-cache Statcast data for top 25 batters and pitchers"
              style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Pre-load Statcast
            </button>
          )}
          <button
            onClick={() => setGlossaryOpen(o => !o)}
            style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span>📖</span> Metric Glossary {glossaryOpen ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {glossaryOpen && (
        <div className="card" style={{ background: 'white' }}>
          <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 12 }}>Stat Definitions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {glossaryStats.map(k => {
              const def = STAT_DEFINITIONS[k]
              if (!def) return null
              return (
                <div key={k} className="flex gap-2">
                  <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: 'var(--accent2)', width: 80, flexShrink: 0, paddingTop: 2 }}>{def.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{def.description}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <TabGroup tabs={PAGE_TABS} onTabChange={(t) => setActiveTab(t as 'batting' | 'pitching')}>
        {(active) => active === 'batting' ? <BattingBoard /> : <PitchingBoard />}
      </TabGroup>
    </div>
  )
}

function BattingBoard() {
  const [season, setSeason] = useState(CURRENT_SEASON)
  const { data, isLoading, isFetching, filters, setFilters } = useBattingLeaderboard(season)

  return (
    <div>
      <LeaderboardFilters
        season={season}
        onSeasonChange={setSeason}
        mode="batting"
        minPa={filters.min_pa}
        onMinPaChange={v => setFilters(f => ({ ...f, min_pa: v, page: 1 }))}
      />
      {isLoading ? (
        <LoadingSpinner label="Loading batting leaderboard..." />
      ) : (
        <>
          <div
            className={isFetching ? 'opacity-60 transition-opacity' : ''}
            style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,25,80,0.06)' }}
          >
            <LeaderboardTable
              data={(data?.data ?? []) as Parameters<typeof LeaderboardTable>[0]['data']}
              visibleStats={BATTING_VISIBLE}
              sortBy={filters.sort_by ?? 'war'}
              order={filters.order ?? 'desc'}
              onSort={key => setFilters(f => ({
                ...f,
                sort_by: key,
                order: f.sort_by === key && f.order === 'desc' ? 'asc' : 'desc',
                page: 1,
              }))}
              rankOffset={((filters.page ?? 1) - 1) * (filters.page_size ?? 50)}
            />
          </div>
          <Pagination
            page={filters.page ?? 1}
            total={data?.total ?? 0}
            pageSize={filters.page_size ?? 50}
            onChange={p => setFilters(f => ({ ...f, page: p }))}
          />
        </>
      )}
    </div>
  )
}

function PitchingBoard() {
  const [season, setSeason] = useState(CURRENT_SEASON)
  const { data, isLoading, isFetching, filters, setFilters } = usePitchingLeaderboard(season)

  return (
    <div>
      <LeaderboardFilters
        season={season}
        onSeasonChange={setSeason}
        mode="pitching"
        minIp={filters.min_ip}
        onMinIpChange={v => setFilters(f => ({ ...f, min_ip: v, page: 1 }))}
      />
      {isLoading ? (
        <LoadingSpinner label="Loading pitching leaderboard..." />
      ) : (
        <>
          <div
            className={isFetching ? 'opacity-60 transition-opacity' : ''}
            style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,25,80,0.06)' }}
          >
            <LeaderboardTable
              data={(data?.data ?? []) as Parameters<typeof LeaderboardTable>[0]['data']}
              visibleStats={PITCHING_VISIBLE}
              sortBy={filters.sort_by ?? 'war'}
              order={filters.order ?? 'desc'}
              onSort={key => setFilters(f => ({
                ...f,
                sort_by: key,
                order: f.sort_by === key && f.order === 'desc' ? 'asc' : 'desc',
                page: 1,
              }))}
              rankOffset={((filters.page ?? 1) - 1) * (filters.page_size ?? 50)}
            />
          </div>
          <Pagination
            page={filters.page ?? 1}
            total={data?.total ?? 0}
            pageSize={filters.page_size ?? 50}
            onChange={p => setFilters(f => ({ ...f, page: p }))}
          />
        </>
      )}
    </div>
  )
}

function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4" style={{ fontSize: 13 }}>
      <span style={{ color: 'var(--text3)' }}>{total} players</span>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          style={{ padding: '4px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
        >← Prev</button>
        <span style={{ color: 'var(--text2)' }}>{page} / {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          style={{ padding: '4px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}
        >Next →</button>
      </div>
    </div>
  )
}
