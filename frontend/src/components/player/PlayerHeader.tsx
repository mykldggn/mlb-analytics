import { MLB_TEAM_COLORS } from '../../utils/constants'

interface Props {
  player: Record<string, unknown>
}

export default function PlayerHeader({ player }: Props) {
  const teamAbbr = String(player.currentTeam ?? '')
  const colors = MLB_TEAM_COLORS[teamAbbr] ?? { primary: '#1e3a5f', secondary: '#374151' }

  return (
    <div className="card overflow-hidden">
      {/* Team color accent bar */}
      <div className="h-1 -mx-4 -mt-4 mb-4" style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})` }} />

      <div className="flex items-start gap-5">
        {/* Headshot */}
        <div className="shrink-0">
          <img
            src={String(player.headshot_url ?? '')}
            alt={String(player.fullName ?? '')}
            className="w-24 h-24 rounded-xl object-cover bg-gray-800"
            onError={e => {
              (e.target as HTMLImageElement).src =
                'https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/0/headshot/67/current'
            }}
          />
        </div>

        {/* Bio */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{String(player.fullName ?? '')}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <span className="text-gray-400 text-sm">{String(player.currentTeam ?? '—')}</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400 text-sm">{String(player.primaryPosition ?? '—')}</span>
            {player.age != null && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-gray-400 text-sm">Age {String(player.age)}</span>
              </>
            )}
            {player.batSide != null && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-gray-400 text-sm">Bats/Throws: {String(player.batSide)}/{String(player.pitchHand ?? '?')}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
            {player.height != null && <span>{String(player.height)}</span>}
            {player.weight != null && <span>{String(player.weight)} lbs</span>}
            {player.birthCity != null && <span>{String(player.birthCity)}{player.birthCountry ? `, ${String(player.birthCountry)}` : ''}</span>}
            {player.mlbDebutDate != null && <span>Debut: {String(player.mlbDebutDate).slice(0, 4)}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
