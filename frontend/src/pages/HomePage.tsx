import { Link } from 'react-router-dom'
import { useBattingLeaderboard, usePitchingLeaderboard } from '../hooks/useLeaderboard'
import { CURRENT_SEASON } from '../utils/constants'
import { formatStat } from '../utils/formatters'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useRef } from 'react'

/* ─── Baseball Diamond SVG (subtle background) ─────────────────────────── */
function BaseballDiamondSVG() {
  return (
    <svg
      viewBox="0 0 420 380"
      style={{
        position: 'absolute',
        bottom: -20,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 520,
        height: 470,
        opacity: 0.07,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      {/* Outfield grass */}
      <path d="M210 340 L30 160 L210 20 L390 160 Z" fill="#2d6a2d" />
      {/* Infield dirt */}
      <path d="M210 340 L120 250 L210 165 L300 250 Z" fill="#8b6340" />
      {/* Outfield wall arc */}
      <path d="M30 160 Q210 -30 390 160" fill="none" stroke="white" strokeWidth="3" />
      {/* Foul lines */}
      <line x1="210" y1="340" x2="30" y2="160" stroke="white" strokeWidth="2" />
      <line x1="210" y1="340" x2="390" y2="160" stroke="white" strokeWidth="2" />
      {/* Bases */}
      <rect x="195" y="152" width="28" height="28" fill="white" rx="2" transform="rotate(45 209 166)" />
      <rect x="107" y="237" width="22" height="22" fill="white" rx="2" transform="rotate(45 118 248)" />
      <rect x="283" y="237" width="22" height="22" fill="white" rx="2" transform="rotate(45 294 248)" />
      {/* Home plate */}
      <polygon points="210,342 197,330 197,318 223,318 223,330" fill="white" />
      {/* Pitcher's mound */}
      <circle cx="210" cy="245" r="12" fill="#7a5530" />
      {/* Base lines on infield */}
      <line x1="210" y1="166" x2="118" y2="248" stroke="white" strokeWidth="1.5" />
      <line x1="210" y1="166" x2="302" y2="248" stroke="white" strokeWidth="1.5" />
      <line x1="118" y1="248" x2="210" y2="330" stroke="white" strokeWidth="1.5" />
      <line x1="302" y1="248" x2="210" y2="330" stroke="white" strokeWidth="1.5" />
    </svg>
  )
}

/* ─── Stitch Dot Pattern ───────────────────────────────────────────────── */
function StitchPattern() {
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0.04,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      <defs>
        <pattern id="stitchPat" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="1.5" fill="#001f5b" />
          <circle cx="30" cy="5"  r="1.5" fill="#001f5b" />
          <circle cx="50" cy="10" r="1.5" fill="#001f5b" />
          <circle cx="5"  cy="30" r="1.5" fill="#001f5b" />
          <circle cx="55" cy="30" r="1.5" fill="#001f5b" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#stitchPat)" />
    </svg>
  )
}

const RANK_BADGES = ['🥇', '🥈', '🥉']

function LeaderCard({ title, statKey, data }: {
  title: string
  statKey: string
  data?: unknown[]
}) {
  return (
    <div
      style={{
        position: 'relative',
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '20px 20px 16px',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,25,80,0.07)',
        transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,25,80,0.10)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLDivElement).style.transform = 'none'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,25,80,0.07)'
      }}
    >
      {/* Gradient bar top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent2))' }} />

      <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 14 }}>
        {title}
      </h3>

      {!data ? (
        <LoadingSpinner size="sm" />
      ) : (
        <ol className="space-y-3">
          {(data as Array<Record<string, unknown>>).map((entry, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>
                {i < 3 ? RANK_BADGES[i] : <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text3)' }}>{i + 1}</span>}
              </span>
              {entry.headshot_url != null && (
                <img
                  src={String(entry.headshot_url)}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                  style={{ background: 'var(--bg3)', border: '1.5px solid rgba(0,25,80,0.12)', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                {entry.mlbam_id ? (
                  <Link
                    to={`/players/${entry.mlbam_id}`}
                    style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', display: 'block' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent2)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
                  >
                    {String(entry.player_name)}
                  </Link>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {String(entry.player_name)}
                  </span>
                )}
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color: 'var(--accent2)', display: 'block', lineHeight: 1.2, marginTop: 1 }}>
                  {formatStat(statKey, (entry.stats as Record<string, unknown>)?.[statKey] as number)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Link
        to="/leaderboards"
        style={{ display: 'block', marginTop: 14, fontSize: 12, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accentH)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--accent)')}
      >
        Full leaderboard →
      </Link>
    </div>
  )
}

/* ─── Feature Card Icons — two-tone navy + red ──────────────────────────── */
const N = '#001f5b'   // navy
const R = '#b8001a'   // red
const SZ = 40

function IconPlayerProfiles() {
  return (
    <svg viewBox="0 0 40 40" width={SZ} height={SZ} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* head */}
      <circle cx="20" cy="13" r="6" stroke={N} strokeWidth="2" />
      {/* body */}
      <path d="M8 36c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke={N} strokeWidth="2" />
      {/* red accent underline */}
      <line x1="8" y1="38" x2="32" y2="38" stroke={R} strokeWidth="2.5" />
    </svg>
  )
}
function IconParkFavorability() {
  return (
    <svg viewBox="0 0 40 40" width={SZ} height={SZ} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* outfield arc */}
      <path d="M5 33 Q20 5 35 33" stroke={N} strokeWidth="2" />
      {/* foul lines */}
      <line x1="20" y1="33" x2="5"  y2="33" stroke={N} strokeWidth="2" />
      <line x1="20" y1="33" x2="35" y2="33" stroke={N} strokeWidth="2" />
      {/* bases — diamond rotated */}
      <rect x="17.5" y="14.5" width="5" height="5" rx="0.5" transform="rotate(45 20 17)" fill={N} />
      <rect x="12"   y="22"   width="4" height="4" rx="0.5" transform="rotate(45 14 24)" fill={N} />
      <rect x="24"   y="22"   width="4" height="4" rx="0.5" transform="rotate(45 26 24)" fill={N} />
      {/* home plate — red */}
      <polygon points="20,34.5 17,32 17,30 23,30 23,32" fill={R} />
    </svg>
  )
}
function IconPlatoonSplits() {
  return (
    <svg viewBox="0 0 40 40" width={SZ} height={SZ} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* left batter — navy */}
      <circle cx="11" cy="9" r="4" stroke={N} strokeWidth="1.8" />
      <path d="M7 14 L7 24 L11 24" stroke={N} strokeWidth="1.8" />
      <line x1="7" y1="19" x2="3" y2="23" stroke={N} strokeWidth="1.8" />
      {/* right batter — red */}
      <circle cx="29" cy="9" r="4" stroke={R} strokeWidth="1.8" />
      <path d="M33 14 L33 24 L29 24" stroke={R} strokeWidth="1.8" />
      <line x1="33" y1="19" x2="37" y2="23" stroke={R} strokeWidth="1.8" />
      {/* centre divider */}
      <line x1="20" y1="5" x2="20" y2="30" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2.5" />
      {/* L / R labels */}
      <text x="11" y="32" textAnchor="middle" fontSize="8" fontFamily="'Barlow Condensed',sans-serif" fontWeight="700" fill={N}>L</text>
      <text x="29" y="32" textAnchor="middle" fontSize="8" fontFamily="'Barlow Condensed',sans-serif" fontWeight="700" fill={R}>R</text>
    </svg>
  )
}
function IconStatcast() {
  return (
    <svg viewBox="0 0 40 40" width={SZ} height={SZ} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* gauge arc — larger, centered lower */}
      <path d="M4 30 A16 16 0 0 1 36 30" stroke={N} strokeWidth="2.2" />
      {/* end ticks */}
      <line x1="4"  y1="30" x2="7.5"  y2="30" stroke={N} strokeWidth="1.8" />
      <line x1="36" y1="30" x2="32.5" y2="30" stroke={N} strokeWidth="1.8" />
      {/* top & diagonal ticks */}
      <line x1="20" y1="14" x2="20"   y2="17.5" stroke={N} strokeWidth="1.8" />
      <line x1="9.5"  y1="18.5" x2="11.8" y2="21"   stroke={N} strokeWidth="1.5" />
      <line x1="30.5" y1="18.5" x2="28.2" y2="21"   stroke={N} strokeWidth="1.5" />
      {/* needle — red, pointing ~70% (toward high end) */}
      <line x1="20" y1="30" x2="30" y2="17" stroke={R} strokeWidth="2.5" strokeLinecap="round" />
      {/* pivot */}
      <circle cx="20" cy="30" r="3"   fill={R} />
      <circle cx="20" cy="30" r="1.2" fill="white" stroke="none" />
    </svg>
  )
}
function IconSprayChart() {
  return (
    <svg viewBox="0 0 40 40" width={SZ} height={SZ} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* foul lines from home plate upward */}
      <line x1="20" y1="35" x2="4"  y2="13" stroke={N} strokeWidth="1.8" />
      <line x1="20" y1="35" x2="36" y2="13" stroke={N} strokeWidth="1.8" />
      {/* outfield wall arc */}
      <path d="M4 13 Q20 4 36 13" stroke={N} strokeWidth="1.8" />
      {/* spray dots — HR (red/large), XBH (navy), singles (blue-grey) */}
      <circle cx="14" cy="20" r="2"   fill={N}       />
      <circle cx="20" cy="10" r="2.5" fill={R}       />
      <circle cx="27" cy="17" r="2"   fill={N}       />
      <circle cx="10" cy="27" r="1.6" fill="#4a6fa5" />
      <circle cx="31" cy="24" r="1.6" fill="#4a6fa5" />
      <circle cx="18" cy="16" r="1.4" fill="#4a6fa5" />
      {/* home plate — red */}
      <polygon points="20,36.5 17.5,34.5 17.5,33 22.5,33 22.5,34.5" fill={R} />
    </svg>
  )
}
function IconPlayerComparison() {
  return (
    <svg viewBox="0 0 40 40" width={SZ} height={SZ} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* player A */}
      <circle cx="12" cy="9"  r="4.5" stroke={N} strokeWidth="2" />
      <path   d="M4 26c0-4.418 3.582-8 8-8" stroke={N} strokeWidth="2" />
      {/* player B */}
      <circle cx="28" cy="9"  r="4.5" stroke={R} strokeWidth="2" />
      <path   d="M36 26c0-4.418-3.582-8-8-8" stroke={R} strokeWidth="2" />
      {/* VS badge */}
      <rect x="14" y="15" width="12" height="10" rx="2" fill={N} />
      <text x="20" y="23" textAnchor="middle" fontSize="7.5" fontFamily="'Barlow Condensed',sans-serif" fontWeight="700" fill="white">VS</text>
      {/* stat bars */}
      <rect x="4"  y="30" width="13" height="3" rx="1" fill={N} />
      <rect x="4"  y="35" width="9"  height="3" rx="1" fill={N} opacity="0.5" />
      <rect x="23" y="30" width="13" height="3" rx="1" fill={R} />
      <rect x="27" y="35" width="9"  height="3" rx="1" fill={R} opacity="0.5" />
    </svg>
  )
}
function IconTeamAnalytics() {
  return (
    <svg viewBox="0 0 40 40" width={SZ} height={SZ} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* axes */}
      <line x1="6" y1="33" x2="6"  y2="8"  stroke={N} strokeWidth="1.8" />
      <line x1="6" y1="33" x2="37" y2="33" stroke={N} strokeWidth="1.8" />
      {/* bars — solid, stepped heights */}
      <rect x="10" y="23" width="6" height="10" rx="1" fill={N} opacity="0.4" />
      <rect x="19" y="17" width="6" height="16" rx="1" fill={N} opacity="0.65" />
      <rect x="28" y="11" width="6" height="22" rx="1" fill={N} opacity="0.9" />
      {/* trend line — red, through bar tops */}
      <polyline points="13,23 22,17 31,11" stroke={R} strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="13" cy="23" r="2.2" fill={R} stroke="none" />
      <circle cx="22" cy="17" r="2.2" fill={R} stroke="none" />
      <circle cx="31" cy="11" r="2.2" fill={R} stroke="none" />
    </svg>
  )
}
function IconContractValue() {
  return (
    <svg viewBox="0 0 40 40" width={SZ} height={SZ} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* outer ring */}
      <circle cx="20" cy="20" r="15" stroke={N} strokeWidth="2" />
      {/* dollar sign as text glyph — crisp and properly sized */}
      <text x="20" y="27" textAnchor="middle" fontSize="22" fontFamily="'Barlow Condensed',Georgia,serif" fontWeight="700" fill={N} stroke="none">$</text>
      {/* WAR badge — red */}
      <circle cx="31" cy="11" r="6" fill={R} />
      <text x="31" y="14.5" textAnchor="middle" fontSize="6.5" fontFamily="'Barlow Condensed',sans-serif" fontWeight="700" fill="white" stroke="none">WAR</text>
    </svg>
  )
}
function IconPitchZone() {
  return (
    <svg viewBox="0 0 40 40" width={SZ} height={SZ} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* strike zone */}
      <rect x="8" y="6" width="24" height="26" rx="1.5" stroke={N} strokeWidth="2" />
      {/* grid */}
      <line x1="16" y1="6"    x2="16" y2="32"    stroke={N} strokeWidth="1.2" opacity="0.6" />
      <line x1="24" y1="6"    x2="24" y2="32"    stroke={N} strokeWidth="1.2" opacity="0.6" />
      <line x1="8"  y1="14.7" x2="32" y2="14.7"  stroke={N} strokeWidth="1.2" opacity="0.6" />
      <line x1="8"  y1="23.3" x2="32" y2="23.3"  stroke={N} strokeWidth="1.2" opacity="0.6" />
      {/* heat zones — center hot (red), mid (orange-ish), outer (cool) */}
      <rect x="16" y="14.7" width="8" height="8.6" rx="0.5" fill={R}       opacity="0.85" />
      <rect x="8"  y="14.7" width="8" height="8.6" rx="0.5" fill="#d97706" opacity="0.5"  />
      <rect x="24" y="6"    width="8" height="8.7" rx="0.5" fill={N}       opacity="0.25" />
      {/* home plate */}
      <path d="M14 36 L20 39 L26 36 L26 33 L14 33 Z" stroke={N} strokeWidth="1.5" />
    </svg>
  )
}

const FEATURES = [
  { icon: <IconPlayerProfiles />,    title: 'Player Profiles',         desc: 'Full stat breakdowns, career arcs, Statcast metrics and multi-year trends.',              to: '/leaderboards' },
  { icon: <IconParkFavorability />,  title: 'Park Favorability Index', desc: 'Custom PFI quantifies each ballpark\'s effect on batters and pitchers (0–200 scale).',    to: '/park-factors' },
  { icon: <IconPlatoonSplits />,     title: 'Platoon Splits',          desc: 'How every player performs vs lefties and righties — on every profile.',                   to: '/leaderboards' },
  { icon: <IconStatcast />,          title: 'Statcast Data',           desc: 'xBA, xSLG, xwOBA, Barrel%, Hard Hit%, Exit Velocity, Launch Angle, Sprint Speed.',       to: '/leaderboards' },
  { icon: <IconSprayChart />,        title: 'Spray Charts',            desc: 'Visualize every batted ball — colored by type — on any player profile.',                  to: '/leaderboards' },
  { icon: <IconPlayerComparison />,  title: 'Player Comparison',       desc: 'Side-by-side radar chart comparisons for up to 4 players across any era.',                to: '/compare' },
  { icon: <IconTeamAnalytics />,     title: 'Team Analytics',          desc: 'Does batting WAR, wRC+, or FIP best predict team wins? Find out.',                        to: '/team-analytics' },
  { icon: <IconContractValue />,     title: 'Contract Value',          desc: 'Who earned their deal and who was overpaid? WAR per $1M of salary.',                      to: '/contract-value' },
  { icon: <IconPitchZone />,         title: 'Pitch Zone Charts',       desc: 'Pitcher location heatmaps — by pitch type and batter handedness.',                        to: '/pitch-zones' },
]

// ~200px per item at this font size; speed = 80px/s
function StatCrawler({ items }: { items: { label: string; val: string }[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  if (items.length === 0) return null

  // Derive duration purely from item count — no state, no re-render, no jump
  const duration = Math.max(20, items.length * 200 / 80)

  const renderItems = (set: { label: string; val: string }[]) =>
    set.map((s, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
        <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>{s.val}</span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border2)', flexShrink: 0, margin: '0 8px' }} />
      </div>
    ))

  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(90deg, var(--bg2), transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(270deg, var(--bg2), transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div
        ref={trackRef}
        style={{ display: 'flex', alignItems: 'center', width: 'max-content', animation: `crawl ${duration}s linear infinite` }}
      >
        {renderItems(items)}
        {renderItems(items)}
      </div>
      <style>{`@keyframes crawl { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  )
}

export default function HomePage() {
  const { data: hrLeaders }   = useBattingLeaderboard(CURRENT_SEASON, { sort_by: 'hr',   order: 'desc', min_pa: 50,  page_size: 5 })
  const { data: warHitters }  = useBattingLeaderboard(CURRENT_SEASON, { sort_by: 'war',  order: 'desc', min_pa: 100, page_size: 5 })
  const { data: eraLeaders }  = usePitchingLeaderboard(CURRENT_SEASON, { sort_by: 'fip', order: 'asc',  min_ip: 50,  page_size: 5 })
  const { data: avgLeaders }  = useBattingLeaderboard(CURRENT_SEASON, { sort_by: 'avg',  order: 'desc', min_pa: 100, page_size: 1 })
  const { data: wrcLeaders }  = useBattingLeaderboard(CURRENT_SEASON, { sort_by: 'wrc_plus', order: 'desc', min_pa: 100, page_size: 1 })
  const { data: rbiLeaders }  = useBattingLeaderboard(CURRENT_SEASON, { sort_by: 'rbi',  order: 'desc', min_pa: 50,  page_size: 1 })
  const { data: sbLeaders }   = useBattingLeaderboard(CURRENT_SEASON, { sort_by: 'sb',   order: 'desc', min_pa: 50,  page_size: 1 })
  const { data: kLeaders }    = usePitchingLeaderboard(CURRENT_SEASON, { sort_by: 'k_per_9', order: 'desc', min_ip: 30, page_size: 1 })
  const { data: eraLow }      = usePitchingLeaderboard(CURRENT_SEASON, { sort_by: 'era', order: 'asc',  min_ip: 50,  page_size: 1 })

  type D = Record<string, unknown>
  const top = (d: typeof hrLeaders) => d?.data?.[0] as D | undefined
  const stat = (d: typeof hrLeaders, key: string) => (top(d)?.stats as D)?.[key]
  const name = (d: typeof hrLeaders) => top(d)?.player_name as string | undefined

  const crawlItems = [
    name(hrLeaders)  && { label: 'HR',    val: `${name(hrLeaders)} — ${stat(hrLeaders, 'hr')}` },
    name(warHitters) && { label: 'WAR',   val: `${name(warHitters)} — ${Number(stat(warHitters, 'war')).toFixed(1)}` },
    name(avgLeaders) && { label: 'AVG',   val: `${name(avgLeaders)} — .${String(Math.round(Number(stat(avgLeaders, 'avg')) * 1000)).padStart(3, '0')}` },
    name(wrcLeaders) && { label: 'wRC+',  val: `${name(wrcLeaders)} — ${stat(wrcLeaders, 'wrc_plus')}` },
    name(rbiLeaders) && { label: 'RBI',   val: `${name(rbiLeaders)} — ${stat(rbiLeaders, 'rbi')}` },
    name(sbLeaders)  && { label: 'SB',    val: `${name(sbLeaders)} — ${stat(sbLeaders, 'sb')}` },
    name(eraLow)     && { label: 'ERA',   val: `${name(eraLow)} — ${stat(eraLow, 'era')}` },
    name(kLeaders)   && { label: 'K/9',   val: `${name(kLeaders)} — ${Number(stat(kLeaders, 'k_per_9')).toFixed(1)}` },
    name(eraLeaders) && { label: 'FIP',   val: `${name(eraLeaders)} — ${stat(eraLeaders, 'fip')}` },
  ].filter(Boolean) as { label: string; val: string }[]

  return (
    <div>

      {/* ── Hero — full bleed, escapes the AppLayout container ───────────── */}
      <section style={{
        position: 'relative',
        minHeight: 460,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        overflow: 'hidden',
        padding: '56px 24px 48px',
        /* Escape the AppLayout px-4 container on both sides */
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        width: '100vw',
        background: 'linear-gradient(160deg, var(--bg2) 0%, var(--bg) 100%)',
      }}>
        {/* Top gradient bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent2) 50%, transparent 100%)' }} />

        {/* Radial glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 55% at 50% 60%, rgba(184,0,26,0.06) 0%, transparent 70%)',
        }} />

        {/* Stitch dots */}
        <StitchPattern />

        {/* Centered baseball diamond */}
        <BaseballDiamondSVG />

        {/* MLB logo */}
        <img
          src="/mlb-logo.png"
          alt="MLB"
          style={{ width: 180, objectFit: 'contain', position: 'relative', zIndex: 1, marginBottom: 24 }}
        />

        {/* Headline */}
        <h1 style={{
          position: 'relative', zIndex: 1,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: 'clamp(2rem, 5.5vw, 3.8rem)',
          color: 'var(--text)',
          lineHeight: 1.1,
          marginBottom: 16,
          letterSpacing: '-0.02em',
        }}>
          MLB Advanced Analytics
        </h1>

        <p style={{
          position: 'relative', zIndex: 1,
          color: 'var(--text2)',
          fontSize: 'clamp(0.9rem, 2vw, 1.05rem)',
          lineHeight: 1.75,
          maxWidth: 540,
          margin: '0 auto 36px',
        }}>
          WAR, wRC+, Statcast metrics, Park Favorability Index, Platoon Splits, Contract Value —{' '}
          <strong style={{ color: 'var(--accent2)' }}>{CURRENT_SEASON} season</strong> data plus records back to 2002.
        </p>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { to: '/leaderboards',   label: 'Leaderboards', primary: true },
            { to: '/park-factors',   label: 'Park Factors' },
            { to: '/compare',        label: 'Compare Players' },
          ].map(({ to, label, primary }) => (
            <Link
              key={to}
              to={to}
              style={{
                padding: '10px 22px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
                background: primary ? 'var(--accent)' : 'transparent',
                border: primary ? 'none' : '1px solid var(--border2)',
                color: primary ? 'white' : 'var(--text)',
              }}
              onMouseEnter={e => {
                if (primary) e.currentTarget.style.background = 'var(--accentH)'
                else e.currentTarget.style.background = 'var(--surface2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = primary ? 'var(--accent)' : 'transparent'
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Stat Crawler — full bleed ────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg2)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '9px 0',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        width: '100vw',
      }}>
        {/* Fixed label */}
        <div style={{
          flexShrink: 0,
          padding: '0 16px',
          borderRight: '1px solid var(--border2)',
          marginRight: 16,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--accent)',
          whiteSpace: 'nowrap',
        }}>
          {CURRENT_SEASON} Leaders
        </div>
        <StatCrawler items={crawlItems} />
      </div>

      {/* ── Leader Cards ─────────────────────────────────────────────────── */}
      <section style={{ padding: '40px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 700, color: 'var(--text)' }}>
            {CURRENT_SEASON} Leaders
          </h2>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>Through {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 960, margin: '0 auto' }}>
          <LeaderCard title="Home Runs"    statKey="hr"  data={hrLeaders?.data} />
          <LeaderCard title="Batting WAR"  statKey="war" data={warHitters?.data} />
          <LeaderCard title="FIP (Starters)" statKey="fip" data={eraLeaders?.data} />
        </div>
      </section>

      {/* ── Feature Grid ─────────────────────────────────────────────────── */}
      <section style={{ padding: '40px 24px 48px' }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
          Features
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {FEATURES.map(f => (
            <Link key={f.title} to={f.to} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '24px 24px 22px',
                  height: '100%',
                  boxShadow: '0 1px 3px rgba(0,25,80,0.06)',
                  transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor = 'var(--accent2)'
                  el.style.transform = 'translateY(-2px)'
                  el.style.boxShadow = '0 6px 20px rgba(0,25,80,0.10)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor = 'var(--border)'
                  el.style.transform = 'none'
                  el.style.boxShadow = '0 1px 3px rgba(0,25,80,0.06)'
                }}
              >
                <div style={{ marginBottom: 14 }}>{f.icon}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '0.01em' }}>{f.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
