import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, ReferenceLine, Label, Cell,
} from 'recharts'
import { fetchTeamAnalytics, fetchTeamAnalyticsAll } from '../api/teamAnalytics'
import { CURRENT_SEASON, MLB_TEAM_COLORS } from '../utils/constants'
import LoadingSpinner from '../components/ui/LoadingSpinner'

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

const SEASONS_RANGE = Array.from({ length: 10 }, (_, i) => CURRENT_SEASON - i)
const ALL_SEASONS = 0  // sentinel value for the "All Seasons" aggregate view

// FanGraphs uses different abbreviations than MLB Stats API in some cases.
// This map normalizes FanGraphs → MLB API abbreviations.
const FG_TO_MLB: Record<string, string> = {
  'CHW': 'CWS',  // White Sox
  'KCR': 'KC',   // Royals
  'SDP': 'SD',   // Padres
  'SFG': 'SF',   // Giants
  'TBR': 'TB',   // Rays
  'WSN': 'WSH',  // Nationals
  'ATH': 'OAK',  // Athletics (2025 Sacramento)
  'TBD': 'TB',
  'CLV': 'CLE',
  'FLA': 'MIA',
}

// FanGraphs full team name → MLB API abbreviation
const TEAM_NAME_TO_ABBR: Record<string, string> = {
  'Angels': 'LAA', 'Astros': 'HOU', 'Athletics': 'OAK', 'Blue Jays': 'TOR',
  'Braves': 'ATL', 'Brewers': 'MIL', 'Cardinals': 'STL', 'Cubs': 'CHC',
  'Diamondbacks': 'ARI', 'Dodgers': 'LAD', 'Giants': 'SF', 'Guardians': 'CLE',
  'Indians': 'CLE', 'Mariners': 'SEA', 'Marlins': 'MIA', 'Mets': 'NYM',
  'Nationals': 'WSH', 'Orioles': 'BAL', 'Padres': 'SD', 'Phillies': 'PHI',
  'Pirates': 'PIT', 'Rangers': 'TEX', 'Rays': 'TB', 'Red Sox': 'BOS',
  'Reds': 'CIN', 'Rockies': 'COL', 'Royals': 'KC', 'Tigers': 'DET',
  'Twins': 'MIN', 'White Sox': 'CWS', 'Yankees': 'NYY',
}

function resolveAbbr(teamName: string | undefined): string {
  if (!teamName) return ''
  const trimmed = teamName.trim()
  // If it's already a short abbreviation, normalize via FG_TO_MLB map
  if (trimmed.length <= 4) return FG_TO_MLB[trimmed] ?? trimmed
  // Full team name — find suffix match
  for (const [suffix, abbr] of Object.entries(TEAM_NAME_TO_ABBR)) {
    if (trimmed.includes(suffix)) return abbr
  }
  return trimmed.slice(0, 3).toUpperCase()
}

interface ScatterPoint {
  abbr: string
  x: number
  y: number
  teamName: string
}

function pearsonR(data: ScatterPoint[]): number | null {
  const n = data.length
  if (n < 3) return null
  const meanX = data.reduce((s, d) => s + d.x, 0) / n
  const meanY = data.reduce((s, d) => s + d.y, 0) / n
  let num = 0, sdX = 0, sdY = 0
  for (const d of data) {
    num += (d.x - meanX) * (d.y - meanY)
    sdX += (d.x - meanX) ** 2
    sdY += (d.y - meanY) ** 2
  }
  const denom = Math.sqrt(sdX * sdY)
  return denom === 0 ? null : num / denom
}

function TeamScatter({
  data, xLabel, yLabel, title, description,
}: {
  data: ScatterPoint[]
  xKey: string
  yKey: string
  xLabel: string
  yLabel: string
  title: string
  description: string
}) {
  const isMobile = useIsMobile()
  const avgX = data.length ? data.reduce((s, d) => s + d.x, 0) / data.length : 0
  const avgY = data.length ? data.reduce((s, d) => s + d.y, 0) / data.length : 0
  const r = pearsonR(data)
  const rLabel = r !== null ? `r = ${r.toFixed(2)}` : ''

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-semibold text-gray-200">{title}</h3>
        {rLabel && <span className="text-xs font-mono text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded">{rLabel}</span>}
      </div>
      <p className="text-xs text-gray-500 mb-4">{description}</p>
      <ResponsiveContainer width="100%" height={isMobile ? 260 : 320}>
        <ScatterChart margin={{ top: 10, right: isMobile ? 8 : 20, bottom: isMobile ? 20 : 30, left: isMobile ? 0 : 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,25,80,0.10)" />
          <XAxis
            type="number" dataKey="x" name={xLabel}
            stroke="var(--border2)"
            tick={isMobile ? false : { fill: 'var(--text3)', fontSize: 11 }}
            domain={['auto', 'auto']}
          >
            {!isMobile && <Label value={xLabel} offset={-10} position="insideBottom" fill="#6b7280" fontSize={12} />}
          </XAxis>
          <YAxis
            type="number" dataKey="y" name={yLabel}
            stroke="var(--border2)"
            tick={isMobile ? false : { fill: 'var(--text3)', fontSize: 11 }}
            width={isMobile ? 10 : 40}
            domain={['auto', 'auto']}
          >
            {!isMobile && <Label value={yLabel} angle={-90} position="insideLeft" fill="#6b7280" fontSize={12} />}
          </YAxis>
          <ReferenceLine x={avgX} stroke="rgba(0,25,80,0.25)" strokeDasharray="4 2" />
          <ReferenceLine y={avgY} stroke="rgba(0,25,80,0.25)" strokeDasharray="4 2" />
          <ReTooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ payload }) => {
              if (!payload?.length) return null
              const d = payload[0].payload as ScatterPoint
              return (
                <div style={{ background: 'white', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,25,80,0.12)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{d.teamName || d.abbr}</div>
                  <div style={{ color: 'var(--text2)' }}>{xLabel}: <span style={{ color: 'var(--text)', fontFamily: "'DM Mono',monospace" }}>{d.x.toFixed(1)}</span></div>
                  <div style={{ color: 'var(--text2)' }}>{yLabel}: <span style={{ color: 'var(--text)', fontFamily: "'DM Mono',monospace" }}>{d.y.toFixed(3)}</span></div>
                </div>
              )
            }}
          />
          <Scatter data={data} name="Teams">
            {data.map((entry, i) => {
              const colors = MLB_TEAM_COLORS[entry.abbr] ?? { primary: '#3b82f6', secondary: '#6b7280' }
              return <Cell key={i} fill={colors.primary} opacity={0.85} />
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      {data.length > 0 && (
        <p className="text-xs text-gray-600 mt-2 text-center">
          Dashed lines = league averages · {data.length} teams plotted
        </p>
      )}
    </div>
  )
}

function LeagueRankTable({
  rows, label, lowerIsBetter = false,
}: {
  rows: { abbr: string; teamName: string; value: number }[]
  statKey?: string
  label: string
  lowerIsBetter?: boolean
}) {
  const sorted = [...rows]
    .filter(r => r.value != null && !isNaN(r.value))
    .sort((a, b) => lowerIsBetter ? a.value - b.value : b.value - a.value)
    .slice(0, 15)

  return (
    <div>
      <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</h4>
      <div className="space-y-1">
        {sorted.map((row, i) => {
          const colors = MLB_TEAM_COLORS[row.abbr] ?? { primary: '#3b82f6', secondary: '#6b7280' }
          const max = sorted[0]?.value || 1
          const pct = lowerIsBetter
            ? ((sorted[sorted.length - 1]?.value || 0) / row.value) * 100
            : (row.value / max) * 100
          return (
            <div key={row.abbr} className="flex items-center gap-2 text-xs">
              <span className="text-gray-600 w-4 text-right">{i + 1}</span>
              <span className="text-gray-300 w-8 font-mono font-semibold">{row.abbr}</span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: colors.primary }} />
              </div>
              <span className="font-mono text-gray-200 w-12 text-right">{row.value.toFixed(1)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TeamAnalyticsPage() {
  const [season, setSeason] = useState(CURRENT_SEASON)
  const [playoffOnly, setPlayoffOnly] = useState(false)

  const isAllSeasons = season === ALL_SEASONS

  const { data, isLoading, error } = useQuery({
    queryKey: ['team-analytics', season],
    queryFn: () => isAllSeasons ? fetchTeamAnalyticsAll() : fetchTeamAnalytics(season),
    staleTime: 60 * 60 * 1000,
  })

  // For all-seasons view: use the backend-computed union of every team that made
  // the playoffs in any season. For single-season: top 12 by win_pct as proxy.
  const playoffAbbrs = (() => {
    if (!data) return new Set<string>()
    if (data.playoff_abbrs) return new Set(data.playoff_abbrs)
    const teams = Object.entries(data.standings)
      .filter(([, s]) => (s as any).win_pct != null)
      .sort((a, b) => Number((b[1] as any).win_pct) - Number((a[1] as any).win_pct))
      .slice(0, 12)
      .map(([abbr]) => abbr)
    return new Set(teams)
  })()

  // Build merged dataset: FanGraphs batting WAR + pitching WAR + standings win%
  const mergedTeams = (() => {
    if (!data) return []
    const result: Record<string, Record<string, unknown>> = {}

    for (const row of data.batting) {
      const abbr = resolveAbbr(row['Team'] as string)
      if (!abbr) continue
      result[abbr] = { abbr, teamName: row['Team'] as string, bat_war: row['WAR'], wrc_plus: row['wRC+'], ops: row['OPS'], hr: row['HR'], r: row['R'] }
    }

    for (const row of data.pitching) {
      const abbr = resolveAbbr(row['Team'] as string)
      if (!abbr) continue
      result[abbr] = { ...(result[abbr] ?? { abbr, teamName: row['Team'] }), pit_war: row['WAR'], era: row['ERA'], fip: row['FIP'] }
    }

    for (const [abbr, s] of Object.entries(data.standings)) {
      result[abbr] = { ...(result[abbr] ?? { abbr, teamName: s.team_name }), ...s }
    }

    return Object.values(result)
  })()

  const filteredTeams = playoffOnly
    ? mergedTeams.filter(r => playoffAbbrs.has(r['abbr'] as string))
    : mergedTeams

  const toScatterWinPct = (xField: string): ScatterPoint[] =>
    filteredTeams
      .filter(r => r[xField] != null && r['win_pct'] != null)
      .map(r => ({
        abbr: r['abbr'] as string,
        teamName: (r['team_name'] || r['teamName']) as string,
        x: Number(r[xField]),
        y: Number(r['win_pct']),
      }))

  const battingWarRows = filteredTeams
    .filter(r => r.bat_war != null)
    .map(r => ({ abbr: r.abbr as string, teamName: r.teamName as string, value: Number(r.bat_war) }))

  const pitchingWarRows = filteredTeams
    .filter(r => r.pit_war != null)
    .map(r => ({ abbr: r.abbr as string, teamName: r.teamName as string, value: Number(r.pit_war) }))

  const wrcRows = filteredTeams
    .filter(r => r.wrc_plus != null)
    .map(r => ({ abbr: r.abbr as string, teamName: r.teamName as string, value: Number(r.wrc_plus) }))

  const fipRows = filteredTeams
    .filter(r => r.fip != null)
    .map(r => ({ abbr: r.abbr as string, teamName: r.teamName as string, value: Number(r.fip) }))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)' }}>Team Historical Analytics</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-2xl">
            {isAllSeasons
              ? 'Per-season averages across 2015–' + CURRENT_SEASON + '. Rate stats (win%, wRC+, FIP) are averaged; WAR is averaged per season to normalize for franchise history.'
              : 'Correlations between team WAR, offense, pitching quality, and wins. Does roster construction explain team success?'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlayoffOnly(o => !o)}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: playoffOnly ? '#d97706' : 'var(--surface)',
              color: playoffOnly ? 'white' : 'var(--text2)',
              border: playoffOnly ? 'none' : '1px solid var(--border)',
            }}
          >
            🏆 Playoff Teams Only
          </button>
          <select
            value={season}
            onChange={e => setSeason(Number(e.target.value))}
            style={{ background: 'white', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
          >
            <option value={ALL_SEASONS}>All Seasons (2015–{CURRENT_SEASON})</option>
            {SEASONS_RANGE.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading team analytics..." />
      ) : error ? (
        <div className="card text-center text-gray-500 py-10">Failed to load team analytics data.</div>
      ) : !data ? null : mergedTeams.length === 0 ? (
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-400">No team data available{isAllSeasons ? ' for all seasons aggregate' : ` for ${season}`}.</p>
          {data.errors && data.errors.length > 0 && (
            <p className="text-xs text-gray-600 mt-2 max-w-lg mx-auto">{data.errors[0]}</p>
          )}
          <p className="text-xs text-gray-600 mt-2">Try selecting a different season (2015–2024 have the best coverage).</p>
        </div>
      ) : (
        <>
          {/* Scatter charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TeamScatter
              data={toScatterWinPct('bat_war')}
              xKey="bat_war" yKey="win_pct"
              xLabel={isAllSeasons ? 'Avg Batting WAR/Season' : 'Batting WAR'} yLabel={isAllSeasons ? 'Avg Win %' : 'Win %'}
              title="Batting WAR vs Win %"
              description={isAllSeasons ? 'Average batting WAR per season vs average win% — which franchises consistently pair elite offenses with wins?' : 'Teams with elite offenses (high batting WAR) tend to win more games. How strong is the correlation?'}
            />
            <TeamScatter
              data={toScatterWinPct('pit_war')}
              xKey="pit_war" yKey="win_pct"
              xLabel={isAllSeasons ? 'Avg Pitching WAR/Season' : 'Pitching WAR'} yLabel={isAllSeasons ? 'Avg Win %' : 'Win %'}
              title="Pitching WAR vs Win %"
              description={isAllSeasons ? 'Average pitching WAR per season vs average win% — does sustained pitching excellence drive long-term winning?' : "Pitching is often called 'the name of the game.' Does pitching WAR predict wins better than batting?"}
            />
            <TeamScatter
              data={toScatterWinPct('wrc_plus')}
              xKey="wrc_plus" yKey="win_pct"
              xLabel={isAllSeasons ? 'Avg Team wRC+' : 'Team wRC+'} yLabel={isAllSeasons ? 'Avg Win %' : 'Win %'}
              title="Team wRC+ vs Win %"
              description={isAllSeasons ? 'Average park-adjusted offense (wRC+) vs average win% across all seasons.' : 'wRC+ (park-adjusted offensive production, 100 = league avg) vs winning percentage.'}
            />
            <TeamScatter
              data={toScatterWinPct('fip')}
              xKey="fip" yKey="win_pct"
              xLabel={isAllSeasons ? 'Avg Team FIP' : 'Team FIP'} yLabel={isAllSeasons ? 'Avg Win %' : 'Win %'}
              title="Team FIP vs Win %"
              description={isAllSeasons ? 'Average FIP vs average win% — lower FIP franchises tend to win more consistently over time.' : 'Lower FIP = better pitching. Does defense-independent pitching quality predict wins?'}
            />
          </div>

          {/* Rankings */}
          <div className="card">
            <h3 className="font-semibold text-gray-200 mb-4">
              {isAllSeasons ? `Team Rankings — All Seasons Avg (2015–${CURRENT_SEASON})` : `${season} Team Rankings`}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <LeagueRankTable rows={battingWarRows} statKey="bat_war" label="Batting WAR" />
              <LeagueRankTable rows={pitchingWarRows} statKey="pit_war" label="Pitching WAR" />
              <LeagueRankTable rows={wrcRows} statKey="wrc_plus" label="Team wRC+" />
              <LeagueRankTable rows={fipRows} statKey="fip" label="Team FIP" lowerIsBetter />
            </div>
          </div>

          {/* Context */}
          <div className="card border-blue-900/50 bg-blue-950/20">
            <h3 className="text-sm font-semibold text-blue-300 mb-2">How to Read These Charts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-400 leading-relaxed">
              <div>
                <span className="text-gray-300 font-medium">WAR (Wins Above Replacement)</span> — measures how many wins a team contributed above a replacement-level team. Higher batting/pitching WAR generally correlates with more actual wins, but championship teams often need both.
              </div>
              <div>
                <span className="text-gray-300 font-medium">wRC+ (Weighted Runs Created+)</span> — park and era-adjusted measure of offensive production. 100 = league average. Teams above 110 are elite offenses; below 90 struggle to score.
              </div>
              <div>
                <span className="text-gray-300 font-medium">FIP (Fielding Independent Pitching)</span> — measures pitching quality using only outcomes the pitcher controls (K, BB, HR). Lower is better. League average ≈ 4.00–4.20. Teams with FIP under 3.70 have elite staffs.
              </div>
              <div>
                <span className="text-gray-300 font-medium">Dashed reference lines</span> = league average for each axis. Teams in the top-right quadrant of WAR vs Win% charts are your playoff contenders; bottom-left are rebuilding teams.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
