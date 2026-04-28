import { MLB_TEAM_COLORS } from '../../utils/constants'

interface Props {
  player: Record<string, unknown>
}

export default function PlayerHeader({ player }: Props) {
  const teamAbbr = String(player.currentTeam ?? '')
  const colors = MLB_TEAM_COLORS[teamAbbr] ?? { primary: '#1e3a5f', secondary: '#374151' }
  const teamId = player.currentTeamId ? Number(player.currentTeamId) : null

  return (
    <div className="card overflow-hidden" style={{ position: 'relative' }}>
      {/* Team color accent bar */}
      <div className="h-1 -mx-4 -mt-4 mb-4" style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})` }} />

      <div className="flex items-start gap-5">
        {/* Headshot */}
        <div className="shrink-0">
          <img
            src={String(player.headshot_url ?? '')}
            alt={String(player.fullName ?? '')}
            className="w-24 h-24 rounded-xl object-cover"
            style={{ background: 'var(--bg3)' }}
            onError={e => {
              (e.target as HTMLImageElement).src =
                'https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/0/headshot/67/current'
            }}
          />
        </div>

        {/* Bio */}
        <div className="flex-1 min-w-0">
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(player.fullName ?? '')}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <span style={{ color: 'var(--text2)', fontSize: 14 }}>{String(player.currentTeam ?? '—')}</span>
            <span style={{ color: 'var(--text3)' }}>·</span>
            <span style={{ color: 'var(--text2)', fontSize: 14 }}>{String(player.primaryPosition ?? '—')}</span>
            {player.age != null && (
              <>
                <span style={{ color: 'var(--text3)' }}>·</span>
                <span style={{ color: 'var(--text2)', fontSize: 14 }}>Age {String(player.age)}</span>
              </>
            )}
            {player.batSide != null && (
              <>
                <span style={{ color: 'var(--text3)' }}>·</span>
                <span style={{ color: 'var(--text2)', fontSize: 14 }}>Bats/Throws: {String(player.batSide)}/{String(player.pitchHand ?? '?')}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2" style={{ fontSize: 12, color: 'var(--text3)' }}>
            {player.height != null && <span>{String(player.height)}</span>}
            {player.weight != null && <span>{String(player.weight)} lbs</span>}
            {player.birthCity != null && <span>{String(player.birthCity)}{player.birthCountry ? `, ${String(player.birthCountry)}` : ''}</span>}
            {player.mlbDebutDate != null && <span>Debut: {String(player.mlbDebutDate).slice(0, 4)}</span>}
          </div>
        </div>

        {/* Team logo */}
        {teamId && (
          <div className="shrink-0 self-center" style={{
            width: 76,
            height: 76,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${colors.primary}22, ${colors.secondary}18)`,
            border: `1px solid ${colors.primary}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src={`https://www.mlbstatic.com/team-logos/team-cap-on-dark/${teamId}.svg`}
              alt={teamAbbr}
              title={teamAbbr}
              width={56}
              height={56}
              style={{ objectFit: 'contain', display: 'block' }}
              onError={e => {
                // fallback to spots raster
                const img = e.currentTarget as HTMLImageElement
                if (!img.src.includes('spots')) {
                  img.src = `https://midfield.mlbstatic.com/v1/team/${teamId}/spots/88`
                } else {
                  img.style.display = 'none'
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
