import { Link } from 'react-router-dom'
import { useBattingLeaderboard, usePitchingLeaderboard } from '../hooks/useLeaderboard'
import { CURRENT_SEASON } from '../utils/constants'
import { formatStat } from '../utils/formatters'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useEffect, useRef, useState } from 'react'

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

const FEATURES = [
  { emoji: '👤', title: 'Player Profiles',          desc: 'Headshots, full stat breakdowns, Statcast metrics, career stats & multi-year trends.' },
  { emoji: '🏟️', title: 'Park Favorability Index',  desc: 'Our custom PFI stat quantifies ballpark effects on batters and pitchers (0–200 scale).' },
  { emoji: '↔️', title: 'Platoon Splits',            desc: 'How every player performs vs LHP and RHP — available on each player profile page.' },
  { emoji: '📡', title: 'Statcast Data',             desc: 'xBA, xSLG, xwOBA, Barrel%, Hard Hit%, Exit Velocity, Launch Angle, Sprint Speed.' },
  { emoji: '🗺️', title: 'Spray Charts',             desc: 'Visualize where every batted ball landed, colored by hit type.' },
  { emoji: '⚖️', title: 'Player Comparison',         desc: 'Side-by-side stat comparison with radar charts for up to 4 players.' },
  { emoji: '📊', title: 'Team Analytics',            desc: 'Batting WAR, pitching WAR, wRC+, and win/loss scatter plots across seasons.' },
  { emoji: '💰', title: 'Contract Value',            desc: 'Who earned their deal? WAR per salary dollar using Lahman salary data.' },
  { emoji: '🎯', title: 'Pitch Zone Charts',         desc: 'Pitcher location heatmaps by pitch type and batter handedness (Statcast).' },
]

function StatCrawler({ items }: { items: { label: string; val: string }[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(40)

  useEffect(() => {
    if (trackRef.current) {
      // Speed: ~120px/s
      const w = trackRef.current.scrollWidth / 2
      setDuration(Math.max(20, w / 120))
    }
  }, [items])

  if (items.length === 0) return null

  const renderItems = (items: { label: string; val: string }[]) =>
    items.map((s, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
        <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>{s.val}</span>
        {/* dot separator */}
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border2)', flexShrink: 0, margin: '0 8px' }} />
      </div>
    ))

  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      {/* Fade edges */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(90deg, var(--bg2), transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(270deg, var(--bg2), transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          animation: `crawl ${duration}s linear infinite`,
          width: 'max-content',
        }}
      >
        {renderItems(items)}
        {/* duplicate for seamless loop */}
        {renderItems(items)}
      </div>
      <style>{`
        @keyframes crawl {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
          {FEATURES.map(f => (
            <div
              key={f.title}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '16px 18px',
                transition: 'border-color 0.15s, transform 0.15s',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'
                ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLDivElement).style.transform = 'none'
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{f.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
