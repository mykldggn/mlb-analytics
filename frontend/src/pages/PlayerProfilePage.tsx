import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { get } from '../api/client'
import { usePlayer, usePlayerSplits, usePlayerBio } from '../hooks/usePlayer'
import { useBattingStats, useBattingTrend, useSprayChart, useCareerBattingStats } from '../hooks/useBattingStats'
import { usePitchingStats, usePitchingTrend, useCareerPitchingStats } from '../hooks/usePitchingStats'
import { requestStatcastJob } from '../api/batting'
import { requestPitcherStatcastJob } from '../api/pitching'
import { CURRENT_SEASON, STAT_DEFINITIONS } from '../utils/constants'
import TabGroup from '../components/ui/TabGroup'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PlayerHeader from '../components/player/PlayerHeader'
import BattingStatsTable from '../components/player/BattingStatsTable'
import PitchingStatsTable from '../components/player/PitchingStatsTable'
import SplitsTable from '../components/player/SplitsTable'
import CareerStatsTable from '../components/player/CareerStatsTable'
import StatTrendChart from '../components/charts/StatTrendChart'
import SprayChart from '../components/charts/SprayChart'
import PitchZoneChart from '../components/charts/PitchZoneChart'
import StatCard from '../components/ui/StatCard'

interface PitchArsenalEntry {
  pitchType?: { description?: string; code?: string }
  percentage?: number
  averageSpeed?: number
  spinRate?: number
  type?: { description?: string }
  [key: string]: unknown
}

function PitchArsenalTable({ arsenal }: { arsenal: PitchArsenalEntry[] }) {
  if (!arsenal || arsenal.length === 0) return <p className="text-gray-500 text-sm">No arsenal data available.</p>
  const hasSpinRate = arsenal.some(p => p.spinRate != null)
  return (
    <div>
      <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Pitch Arsenal</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th className="pb-2 pr-4 font-medium">Pitch</th>
              <th className="pb-2 pr-4 font-medium text-right">Usage%</th>
              <th className="pb-2 pr-4 font-medium text-right">Velo</th>
              {hasSpinRate && <th className="pb-2 pr-4 font-medium text-right">Spin</th>}
            </tr>
          </thead>
          <tbody>
            {arsenal.map((p, i) => {
              const name = p.pitchType?.description ?? p.type?.description ?? `Pitch ${i + 1}`
              const pct = p.percentage != null ? `${(p.percentage * 100).toFixed(1)}%` : '—'
              const velo = p.averageSpeed != null ? `${Number(p.averageSpeed).toFixed(1)}` : '—'
              const spin = p.spinRate != null ? `${Math.round(Number(p.spinRate))}` : '—'
              return (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 pr-4 text-gray-200">{name}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{pct}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{velo}</td>
                  {hasSpinRate && <td className="py-2 pr-4 text-right text-gray-300">{spin}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const PITCHER_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'pitching', label: 'Pitching' },
  { key: 'splits', label: 'Platoon Splits' },
  { key: 'charts', label: 'Charts' },
  { key: 'career', label: 'Career' },
]

const BATTER_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'batting', label: 'Batting' },
  { key: 'splits', label: 'Platoon Splits' },
  { key: 'charts', label: 'Charts' },
  { key: 'career', label: 'Career' },
]

const TWO_WAY_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'batting', label: 'Batting' },
  { key: 'pitching', label: 'Pitching' },
  { key: 'splits', label: 'Platoon Splits' },
  { key: 'charts', label: 'Charts' },
  { key: 'career', label: 'Career' },
]

export default function PlayerProfilePage() {
  const { playerId } = useParams<{ playerId: string }>()
  const id = playerId ? Number(playerId) : undefined
  const [season, setSeason] = useState(CURRENT_SEASON)
  const TAB_STORAGE_KEY = 'playerProfile_activeTab'
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem(TAB_STORAGE_KEY) ?? 'overview')

  function handleTabChange(tab: string) {
    setActiveTab(tab)
    sessionStorage.setItem(TAB_STORAGE_KEY, tab)
  }
  const queryClient = useQueryClient()
  const [sprayLoading, setSprayLoading] = useState(false)
  const [pitchZoneLoading, setPitchZoneLoading] = useState(false)
  const sprayPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pitchZonePollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: player, isLoading: playerLoading, error: playerError } = usePlayer(id)
  const { data: bio } = usePlayerBio(id)
  const { data: batting } = useBattingStats(id, season)
  const { data: pitching } = usePitchingStats(id, season)

  // Only fetch splits when the user navigates to that tab to avoid freezing
  const position = String((player as Record<string, unknown>)?.primaryPosition ?? '')
  const isPitcherEarly = ['SP', 'RP', 'P'].includes(position)
  const isTwoWayDetected = !isPitcherEarly && !!pitching && Object.keys(pitching as object).length > 5
  const [splitsView, setSplitsView] = useState<'hitting' | 'pitching'>('hitting')
  const splitsGroup = isPitcherEarly ? 'pitching' : (isTwoWayDetected ? splitsView : 'hitting')
  const { data: splitsData, isLoading: splitsLoading, isError: splitsError } = usePlayerSplits(
    activeTab === 'splits' ? id : undefined,
    season,
    splitsGroup,
  )
  const { data: sprayData } = useSprayChart(id, season)

  // Pitch zone status — same query key as PitchZoneChart, so no duplicate requests
  const pitchZoneEnabled = !!id && (isPitcherEarly || isTwoWayDetected)
  const { data: pitchZoneStatus } = useQuery<{ status: string }>({
    queryKey: ['pitch-zones', id, season, 'all', 'all'],
    queryFn: () => get(`/pitching/${id}/pitch-zones/${season}`, { split: 'all', pitch_type: 'all' }),
    enabled: pitchZoneEnabled,
    staleTime: 30 * 60 * 1000,
  })

  // Lazy-load career stats only when the user navigates to the Career tab
  const { data: careerBatting, isLoading: careerBattingLoading } = useCareerBattingStats(
    activeTab === 'career' ? id : undefined
  )
  const { data: careerPitching, isLoading: careerPitchingLoading } = useCareerPitchingStats(
    activeTab === 'career' ? id : undefined
  )

  // Auto-trigger refs: track which id+season combos we've already kicked off
  const autoTriggeredSprayRef  = useRef<string | null>(null)
  const autoTriggeredZoneRef   = useRef<string | null>(null)

  // Auto-trigger spray chart if not cached (fires without user clicking anything)
  useEffect(() => {
    if (!id || isPitcherEarly) return
    const key = `${id}_${season}`
    if (autoTriggeredSprayRef.current === key) return
    if (sprayData?.status === 'not_cached') {
      autoTriggeredSprayRef.current = key
      triggerSprayChart()
    }
  }, [id, season, sprayData?.status, isPitcherEarly])

  // Auto-trigger pitch zone if not cached
  useEffect(() => {
    if (!id || !pitchZoneEnabled) return
    const key = `${id}_${season}`
    if (autoTriggeredZoneRef.current === key) return
    if (pitchZoneStatus?.status === 'not_cached') {
      autoTriggeredZoneRef.current = key
      triggerPitchZone()
    }
  }, [id, season, pitchZoneStatus?.status, pitchZoneEnabled])

  async function triggerSprayChart() {
    if (!id) return
    setSprayLoading(true)
    try {
      await requestStatcastJob(id, `${season}-03-20`, `${season}-11-01`)
    } catch {}
    sprayPollRef.current = setInterval(async () => {
      await queryClient.refetchQueries({ queryKey: ['spray-chart', id, season] })
      const data = queryClient.getQueryData(['spray-chart', id, season]) as { status?: string } | undefined
      if (data?.status === 'ready') {
        clearInterval(sprayPollRef.current!)
        setSprayLoading(false)
      }
    }, 5000)
    setTimeout(() => { clearInterval(sprayPollRef.current!); setSprayLoading(false) }, 180_000)
  }

  async function triggerPitchZone() {
    if (!id) return
    setPitchZoneLoading(true)
    try {
      await requestPitcherStatcastJob(id, `${season}-03-20`, `${season}-11-01`)
    } catch {}
    pitchZonePollRef.current = setInterval(async () => {
      await queryClient.refetchQueries({ queryKey: ['pitch-zones', id, season, 'all', 'all'] })
      const data = queryClient.getQueryData(['pitch-zones', id, season, 'all', 'all']) as { status?: string } | undefined
      if (data?.status === 'ready') {
        clearInterval(pitchZonePollRef.current!)
        setPitchZoneLoading(false)
      }
    }, 5000)
    setTimeout(() => { clearInterval(pitchZonePollRef.current!); setPitchZoneLoading(false) }, 180_000)
  }

  if (playerLoading) return (
    <div className="space-y-5 animate-pulse">
      {/* Header skeleton */}
      <div className="card flex items-center gap-4 p-4">
        <div className="w-20 h-20 rounded-full bg-gray-800 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-6 bg-gray-800 rounded w-48" />
          <div className="h-4 bg-gray-800 rounded w-32" />
          <div className="h-4 bg-gray-800 rounded w-24" />
        </div>
      </div>
      {/* Tab skeleton */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {[80, 60, 100, 60, 55].map((w, i) => (
          <div key={i} className="h-8 bg-gray-800 rounded" style={{ width: w }} />
        ))}
      </div>
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="card h-16 bg-gray-800/50" />
        ))}
      </div>
    </div>
  )
  if (playerError || !player) return <div className="text-red-400 text-sm">Player not found.</div>

  const p = player as Record<string, unknown>
  const isPitcher = isPitcherEarly
  const isTwoWay = isTwoWayDetected
  const tabs = isPitcher ? PITCHER_TABS : (isTwoWay ? TWO_WAY_TABS : BATTER_TABS)

  return (
    <div className="space-y-5">
      <PlayerHeader player={p} />

      {/* Season selector */}
      <div className="flex justify-end">
        <select
          value={season}
          onChange={e => setSeason(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        >
          {Array.from({ length: 11 }, (_, i) => CURRENT_SEASON - i).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <TabGroup tabs={tabs} onTabChange={handleTabChange}>
        {(active) => {
          if (active === 'overview') {
            const isStatsLoading = isPitcher ? !pitching : !batting
            if (isStatsLoading) return <LoadingSpinner label="Loading stats..." />
            const stats = (batting ?? {}) as Record<string, unknown>
            const pstats = (pitching ?? {}) as Record<string, unknown>
            const keyBatting = ['war', 'wrc_plus', 'woba', 'ops', 'hr', 'avg', 'k_pct', 'bb_pct', 'babip', 'iso', 'g', 'pa', 'sb']
            const keyPitching = ['war', 'era', 'fip', 'xfip', 'k_per_9', 'bb_per_9', 'whip', 'k_pct', 'bb_pct', 'g', 'gs', 'ip', 'csw_pct', 'stuff_plus']
            const keys = isPitcher ? keyPitching : keyBatting
            const src = isPitcher ? pstats : stats
            const visible = keys.filter(k => src[k] != null)
            if (visible.length === 0) {
              return (
                <p className="text-gray-500 text-sm py-4">
                  No {season} stats available. Try selecting a different season.
                </p>
              )
            }
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {visible.map(k => (
                    <StatCard key={k} statKey={k} value={src[k] as number} />
                  ))}
                </div>
                {bio && <PlayerBioSection bio={bio} />}
              </div>
            )
          }

          if (active === 'batting') {
            if (isPitcher) return <p className="text-gray-500 text-sm py-4">No Batting Data Available (Pitcher)</p>
            if (!batting) return <LoadingSpinner label="Loading batting stats..." />
            return <BattingStatsTable stats={batting as Record<string, unknown>} />
          }

          if (active === 'pitching') {
            if (!pitching) return <LoadingSpinner label="Loading pitching stats..." />
            return (
              <div className="space-y-6">
                <PitchingStatsTable stats={pitching as Record<string, unknown>} />
                {(pitching as Record<string, unknown>).pitch_arsenal != null && (
                  <PitchArsenalTable arsenal={(pitching as Record<string, unknown>).pitch_arsenal as PitchArsenalEntry[]} />
                )}
              </div>
            )
          }

          if (active === 'splits') {
            if (splitsLoading) return <LoadingSpinner label="Loading splits..." />
            if (splitsError) return <p className="text-gray-500 text-sm py-4">Split data unavailable for this player/season.</p>
            const splits = (splitsData?.splits ?? []) as Array<Record<string, unknown>>
            return (
              <div className="space-y-3">
                {isTwoWay && (
                  <div className="flex gap-2">
                    {(['hitting', 'pitching'] as const).map(view => (
                      <button
                        key={view}
                        onClick={() => setSplitsView(view)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          splitsView === view ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {view === 'hitting' ? 'Batting Splits' : 'Pitching Splits'}
                      </button>
                    ))}
                  </div>
                )}
                <SplitsTable splits={splits as unknown as Parameters<typeof SplitsTable>[0]['splits']} />
              </div>
            )
          }

          if (active === 'career') {
            if (isTwoWay) {
              if (careerBattingLoading || careerPitchingLoading) return <LoadingSpinner label="Loading career stats..." />
              return (
                <div className="space-y-8">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-300 border-b border-gray-800 pb-2">Career Batting</h3>
                    {careerBatting && (careerBatting.year_by_year ?? []).length > 0 ? (
                      <CareerStatsTable
                        yearByYear={(careerBatting.year_by_year ?? []) as Record<string, unknown>[]}
                        careerTotals={(careerBatting.career_totals ?? {}) as Record<string, unknown>}
                        isPitcher={false}
                      />
                    ) : <p className="text-gray-500 text-sm">No career batting data available.</p>}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-300 border-b border-gray-800 pb-2">Career Pitching</h3>
                    {careerPitching && (careerPitching.year_by_year ?? []).length > 0 ? (
                      <CareerStatsTable
                        yearByYear={(careerPitching.year_by_year ?? []) as Record<string, unknown>[]}
                        careerTotals={(careerPitching.career_totals ?? {}) as Record<string, unknown>}
                        isPitcher={true}
                      />
                    ) : <p className="text-gray-500 text-sm">No career pitching data available.</p>}
                  </div>
                </div>
              )
            }
            const isLoading = isPitcher ? careerPitchingLoading : careerBattingLoading
            if (isLoading) return <LoadingSpinner label="Loading career stats..." />
            const careerData = isPitcher ? careerPitching : careerBatting
            if (!careerData) return <p className="text-gray-500 text-sm">No career data available.</p>
            const yby = (careerData.year_by_year ?? []) as Record<string, unknown>[]
            const totals = (careerData.career_totals ?? {}) as Record<string, unknown>
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-300">Career Statistics</h3>
                  <span className="text-xs text-gray-500">{yby.length} season{yby.length !== 1 ? 's' : ''}</span>
                </div>
                <CareerStatsTable yearByYear={yby} careerTotals={totals} isPitcher={isPitcher} />
              </div>
            )
          }

          if (active === 'charts') {
            return (
              <div className="space-y-8">
                {/* Pitch zone chart for pitchers (and two-way players) */}
                {(isPitcher || isTwoWay) && id && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-300">Pitch Zone Frequency</h3>
                      {pitchZoneLoading ? (
                        <div className="flex items-center gap-1.5 text-xs text-blue-400">
                          <LoadingSpinner size="sm" />
                          <span>Fetching Statcast data…</span>
                        </div>
                      ) : pitchZoneStatus?.status === 'ready' ? (
                        <button onClick={triggerPitchZone} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                          Refresh {season}
                        </button>
                      ) : null}
                    </div>
                    <PitchZoneChart playerId={id} season={season} />
                  </div>
                )}

                {/* Spray chart for hitters (and two-way players) */}
                {(!isPitcher || isTwoWay) && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-300">Spray Chart</h3>
                      {sprayLoading ? (
                        <div className="flex items-center gap-1.5 text-xs text-blue-400">
                          <LoadingSpinner size="sm" />
                          <span>Fetching Statcast data…</span>
                        </div>
                      ) : sprayData?.status === 'ready' ? (
                        <button onClick={triggerSprayChart} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                          Refresh {season}
                        </button>
                      ) : null}
                    </div>
                    {sprayData?.status === 'ready' && sprayData.data ? (
                      <SprayChart points={sprayData.data as Parameters<typeof SprayChart>[0]['points']} />
                    ) : !sprayLoading ? (
                      <p className="text-gray-600 text-sm">No Statcast data available for {season}.</p>
                    ) : null}
                  </div>
                )}

                {/* Trend chart */}
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Multi-Year Trend</h3>
                  <TrendSection playerId={id!} isPitcher={isPitcher} />
                </div>
              </div>
            )
          }
          return null
        }}
      </TabGroup>
    </div>
  )
}

interface BioData {
  highSchool?: string
  college?: string
  draftYear?: number
  birthDate?: string
  birthCity?: string
  birthStateProvince?: string
  birthCountry?: string
  mlbDebutDate?: string
  teamHistory?: { team: string; teamName?: string; startYear: string; endYear: string }[]
}

function PlayerBioSection({ bio }: { bio: BioData }) {
  const birthplace = [bio.birthCity, bio.birthStateProvince, bio.birthCountry].filter(Boolean).join(', ')
  const debut = bio.mlbDebutDate ? new Date(bio.mlbDebutDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null

  // Compress team history: merge consecutive years with same team
  const teams: { team: string; teamName?: string; years: string }[] = []
  if (bio.teamHistory) {
    for (const entry of bio.teamHistory) {
      const last = teams[teams.length - 1]
      const yearRange = entry.startYear === entry.endYear ? entry.startYear : `${entry.startYear}–${entry.endYear}`
      if (last && last.team === entry.team) {
        last.years = last.years.split('–')[0] + '–' + entry.endYear
      } else {
        teams.push({ team: entry.team, teamName: entry.teamName, years: yearRange })
      }
    }
  }

  const items: { label: string; value: string }[] = []
  if (birthplace) items.push({ label: 'Born', value: birthplace })
  if (bio.highSchool) items.push({ label: 'High School', value: bio.highSchool })
  if (bio.college) items.push({ label: 'College', value: bio.college })
  if (bio.draftYear) items.push({ label: 'Draft', value: `${bio.draftYear} MLB Draft` })
  if (debut) items.push({ label: 'MLB Debut', value: debut })

  if (items.length === 0 && teams.length === 0) return null

  return (
    <div className="rounded-lg border border-gray-800 p-4 space-y-3">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium">Career Bio</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
        {items.map(({ label, value }) => (
          <div key={label} className="flex gap-2 text-sm">
            <span className="text-gray-500 shrink-0 w-24">{label}</span>
            <span className="text-gray-300">{value}</span>
          </div>
        ))}
      </div>
      {teams.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">MLB Teams</div>
          <div className="flex flex-wrap gap-2">
            {teams.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-gray-800/60 rounded px-2.5 py-1">
                <span className="text-gray-200 text-sm font-medium">{t.teamName || t.team}</span>
                <span className="text-gray-500 text-xs">{t.years}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TrendSection({ playerId, isPitcher }: { playerId: number; isPitcher: boolean }) {
  const [selectedStat, setSelectedStat] = useState(isPitcher ? 'era' : 'wrc_plus')
  const { data, isLoading } = isPitcher
    ? usePitchingTrend(playerId, selectedStat)
    : useBattingTrend(playerId, selectedStat)

  const trendStats = isPitcher
    ? ['era', 'fip', 'war', 'k_per_9', 'bb_per_9', 'whip', 'siera', 'xfip']
    : ['wrc_plus', 'war', 'woba', 'ops', 'avg', 'iso', 'babip', 'k_pct', 'bb_pct', 'hr']

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {trendStats.map(k => (
          <button
            key={k}
            onClick={() => setSelectedStat(k)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              selectedStat === k ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {STAT_DEFINITIONS[k]?.label ?? k.toUpperCase()}
          </button>
        ))}
      </div>
      {isLoading ? (
        <LoadingSpinner size="sm" />
      ) : data ? (
        <StatTrendChart data={data.trend} statKey={selectedStat} />
      ) : null}
    </div>
  )
}
