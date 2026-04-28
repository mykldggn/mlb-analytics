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

function TeamBlock({ team, isWinner, isLive }: { team: GameTeam; isWinner: boolean; isLive: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <img
        src={LOGO_URL(team.id)}
        alt={team.abbrev}
        width={22}
        height={22}
        style={{ objectFit: 'contain', flexShrink: 0 }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
      />
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        color: isWinner ? 'var(--text)' : 'var(--text3)',
        fontFamily: "'Barlow Condensed', sans-serif",
        letterSpacing: '0.03em',
        minWidth: 26,
      }}>
        {team.abbrev}
      </span>
      <span style={{
        fontSize: 13,
        fontWeight: isWinner ? 700 : 400,
        color: isWinner ? 'var(--text)' : 'var(--text2)',
        fontFamily: "'DM Mono', monospace",
        minWidth: 14,
        textAlign: 'right',
      }}>
        {team.score ?? (isLive ? '0' : '—')}
      </span>
    </div>
  )
}

function GameCard({ game }: { game: Game }) {
  const isLive = game.status === 'Live'
  const isFinal = game.status === 'Final'
  const awayScore = game.away.score ?? 0
  const homeScore = game.home.score ?? 0
  const awayWins = isFinal && awayScore > homeScore
  const homeWins = isFinal && homeScore > awayScore

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      padding: '5px 14px',
      borderRight: '1px solid var(--border)',
      flexShrink: 0,
      position: 'relative',
    }}>
      {isLive && (
        <span style={{
          position: 'absolute',
          top: 4,
          right: 6,
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: '#22c55e',
          boxShadow: '0 0 4px #22c55e',
        }} />
      )}
      <TeamBlock team={game.away} isWinner={awayWins} isLive={isLive} />
      <TeamBlock team={game.home} isWinner={homeWins} isLive={isLive} />
      <div style={{
        fontSize: 9,
        color: isLive ? '#22c55e' : 'var(--text3)',
        fontWeight: isLive ? 600 : 400,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginTop: 1,
        textAlign: 'center',
      }}>
        {game.statusLabel}
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
      const data = await get<{ games: Game[] }>('/games/today')
      setGames(data.games ?? [])
    } catch {
      // silently fail — ticker is non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGames()
    // Refresh every 30s if there are live games (checked after first load)
    intervalRef.current = setInterval(fetchGames, 30_000)
    return () => clearInterval(intervalRef.current)
  }, [])

  if (loading || games.length === 0) return null

  return (
    <div style={{
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        minWidth: 'max-content',
        height: 68,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderRight: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text3)',
            whiteSpace: 'nowrap',
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
