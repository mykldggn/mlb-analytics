import { useEffect, useRef, useState } from 'react'
import { get } from '../../api/client'

interface GameTeam {
  id: number
  abbrev: string
  score: number | null
}

interface Game {
  gamePk: number
  status: 'Preview' | 'Live' | 'Final'
  statusLabel: string
  away: GameTeam
  home: GameTeam
}

const LOGO_URL = (id: number) => `https://midfield.mlbstatic.com/v1/team/${id}/spots/88`

function GameCard({ game }: { game: Game }) {
  const isLive = game.status === 'Live'
  const isFinal = game.status === 'Final'
  const isPreview = game.status === 'Preview'
  const awayScore = game.away.score ?? 0
  const homeScore = game.home.score ?? 0
  const awayWins = isFinal && awayScore > homeScore
  const homeWins = isFinal && homeScore > awayScore

  const scoreColor = (wins: boolean) =>
    isFinal ? (wins ? 'var(--text)' : 'var(--text3)') : 'var(--text2)'
  const abbrevColor = (wins: boolean) =>
    isFinal ? (wins ? 'var(--text)' : 'var(--text3)') : 'var(--text2)'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 16px',
      borderRight: '1px solid var(--border)',
      flexShrink: 0,
      height: '100%',
      position: 'relative',
    }}>
      {/* Teams column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Away */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <img src={LOGO_URL(game.away.id)} alt={game.away.abbrev} width={18} height={18}
            style={{ objectFit: 'contain', flexShrink: 0 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
          <span style={{
            fontSize: 11, fontWeight: 600, width: 28, letterSpacing: '0.02em',
            fontFamily: "'Barlow Condensed', sans-serif",
            color: abbrevColor(awayWins),
          }}>{game.away.abbrev}</span>
          <span style={{
            fontSize: 12, fontWeight: awayWins ? 700 : 400, width: 16, textAlign: 'right',
            fontFamily: "'DM Mono', monospace",
            color: scoreColor(awayWins),
          }}>
            {isPreview ? '—' : game.away.score ?? 0}
          </span>
        </div>
        {/* Home */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <img src={LOGO_URL(game.home.id)} alt={game.home.abbrev} width={18} height={18}
            style={{ objectFit: 'contain', flexShrink: 0 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
          <span style={{
            fontSize: 11, fontWeight: 600, width: 28, letterSpacing: '0.02em',
            fontFamily: "'Barlow Condensed', sans-serif",
            color: abbrevColor(homeWins),
          }}>{game.home.abbrev}</span>
          <span style={{
            fontSize: 12, fontWeight: homeWins ? 700 : 400, width: 16, textAlign: 'right',
            fontFamily: "'DM Mono', monospace",
            color: scoreColor(homeWins),
          }}>
            {isPreview ? '—' : game.home.score ?? 0}
          </span>
        </div>
      </div>

      {/* Status label */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        minWidth: 50,
      }}>
        {isLive && (
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#22c55e', boxShadow: '0 0 5px #22c55e',
            flexShrink: 0,
          }} />
        )}
        <span style={{
          fontSize: 9,
          fontWeight: isLive ? 700 : 400,
          color: isLive ? '#22c55e' : 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          textAlign: 'center',
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
        }}>
          {game.statusLabel}
        </span>
      </div>
    </div>
  )
}

export default function ScoresTicker() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  async function fetchGames() {
    try {
      const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local timezone
      const data = await get<{ games: Game[] }>('/games/today', { date: today })
      setGames(data.games ?? [])
    } catch {
      // silently fail — ticker is non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGames()
    intervalRef.current = setInterval(fetchGames, 30_000)
    return () => clearInterval(intervalRef.current)
  }, [])

  if (loading || games.length === 0) return null

  return (
    <div style={{
      background: 'var(--bg)',
      borderTop: '1px solid var(--border)',
      borderBottom: '2px solid var(--border2)',
      overflow: 'hidden',
      height: 64,
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        minWidth: 'max-content',
        height: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {/* "TODAY" label */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          borderRight: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.12em', color: 'var(--text3)', whiteSpace: 'nowrap',
          }}>
            Today
          </span>
        </div>

        {games.map(game => (
          <GameCard key={game.gamePk} game={game} />
        ))}
      </div>
    </div>
  )
}
