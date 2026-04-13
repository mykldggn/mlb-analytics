import { Link } from 'react-router-dom'
import { useBattingLeaderboard, usePitchingLeaderboard } from '../hooks/useLeaderboard'
import { CURRENT_SEASON } from '../utils/constants'
import { formatStat } from '../utils/formatters'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function HomePage() {
  const { data: hrLeaders } = useBattingLeaderboard(CURRENT_SEASON, { sort_by: 'hr', order: 'desc', min_pa: 50, page_size: 5 })
  const { data: warHitters } = useBattingLeaderboard(CURRENT_SEASON, { sort_by: 'war', order: 'desc', min_pa: 100, page_size: 5 })
  const { data: eraLeaders } = usePitchingLeaderboard(CURRENT_SEASON, { sort_by: 'fip', order: 'asc', min_ip: 50, page_size: 5 })

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="text-center py-12">
        <div className="text-6xl mb-4">⚾</div>
        <h1 className="text-4xl font-bold text-white mb-3">MLB Advanced Analytics</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          WAR, wRC+, Statcast metrics, Park Favorability Index, Platoon Splits, Contract Value analysis, and more —
          {' '}<span className="text-blue-400">{CURRENT_SEASON} season</span> data plus historical records back to 2002.
        </p>
        <div className="flex justify-center gap-4 mt-6">
          <Link to="/leaderboards" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
            Leaderboards
          </Link>
          <Link to="/park-factors" className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-6 py-2 rounded-lg font-medium transition-colors">
            Park Factors
          </Link>
          <Link to="/compare" className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-6 py-2 rounded-lg font-medium transition-colors">
            Compare Players
          </Link>
        </div>
      </section>

      {/* Leader cards */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">{CURRENT_SEASON} Leaders</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <LeaderCard title="Home Runs" statKey="hr" data={hrLeaders?.data} />
          <LeaderCard title="Batting WAR" statKey="war" data={warHitters?.data} />
          <LeaderCard title="FIP (Starters)" statKey="fip" data={eraLeaders?.data} lowerIsBetter />
        </div>
      </section>

      {/* Feature cards */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Player Profiles', desc: 'Full stat breakdowns, career stats, headshots, Statcast metrics, and multi-year trends — search any MLB player.', link: '/leaderboards', icon: '👤' },
            { title: 'Park Favorability Index', desc: 'Our custom PFI statistic quantifies ballpark effects on batters and pitchers (0–200 scale).', link: '/park-factors', icon: '🏟️' },
            { title: 'Platoon Splits', desc: 'How every player performs vs left-handed and right-handed opponents — available on each player profile.', icon: '↔️', link: '/leaderboards' },
            { title: 'Statcast Data', desc: 'xBA, xSLG, xwOBA, Barrel%, Hard Hit%, Exit Velocity, Launch Angle, Sprint Speed.', icon: '📡', link: '/leaderboards' },
            { title: 'Spray Charts', desc: 'Visualize where every batted ball landed — colored by type. Available on each player profile page.', icon: '🗺️', link: '/leaderboards' },
            { title: 'Player Comparison', desc: 'Side-by-side stat comparison with radar charts for up to 4 players.', icon: '⚖️', link: '/compare' },
            { title: 'Team Analytics', desc: 'Does batting WAR, pitching WAR, or wRC+ best predict wins? Explore team-level correlations across seasons.', icon: '📊', link: '/team-analytics' },
            { title: 'Contract Value', desc: 'Who earned their contract and who was overpaid? WAR per salary dollar for historical seasons using the Lahman database (through 2016).', icon: '💰', link: '/contract-value' },
            { title: 'Pitch Zone Charts', desc: 'Pitcher location heatmaps — see where pitchers throw by pitch type and batter handedness using Statcast data.', icon: '🎯', link: '/pitch-zones' },
          ].map(f => (
            <Link key={f.title} to={f.link} className="card-hover group">
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="font-semibold text-gray-200 mb-1 group-hover:text-blue-400 transition-colors">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

const RANK_BADGES = ['🥇', '🥈', '🥉']

function LeaderCard({ title, statKey, data }: {
  title: string; statKey: string; data?: unknown[]; lowerIsBetter?: boolean
}) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
      {!data ? (
        <LoadingSpinner size="sm" />
      ) : (
        <ol className="space-y-3">
          {(data as Array<Record<string, unknown>>).map((entry, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base w-6 shrink-0 text-center">
                  {i < 3 ? RANK_BADGES[i] : <span className="text-xs text-gray-600">{i + 1}</span>}
                </span>
                {entry.headshot_url != null && (
                  <img src={String(entry.headshot_url)} alt="" className="w-9 h-9 rounded-full bg-gray-700 shrink-0 object-cover" />
                )}
                {entry.mlbam_id ? (
                  <Link to={`/players/${entry.mlbam_id}`} className="text-sm text-gray-200 hover:text-blue-400 transition-colors truncate">
                    {String(entry.player_name)}
                  </Link>
                ) : (
                  <span className="text-sm text-gray-200 truncate">{String(entry.player_name)}</span>
                )}
              </div>
              <span className="font-mono text-sm text-gray-100 font-semibold shrink-0">
                {formatStat(statKey, (entry.stats as Record<string, unknown>)?.[statKey] as number)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <Link to="/leaderboards" className="block mt-3 text-xs text-blue-500 hover:text-blue-400 transition-colors">
        Full leaderboard →
      </Link>
    </div>
  )
}
