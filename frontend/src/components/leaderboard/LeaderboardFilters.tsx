import { SEASONS } from '../../utils/constants'

const ctrlStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid var(--border2)',
  borderRadius: 8,
  padding: '5px 10px',
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
}

interface Props {
  season: number
  onSeasonChange: (s: number) => void
  minPa?: number
  onMinPaChange?: (v: number) => void
  minIp?: number
  onMinIpChange?: (v: number) => void
  mode: 'batting' | 'pitching'
}

export default function LeaderboardFilters({ season, onSeasonChange, minPa, onMinPaChange, minIp, onMinIpChange, mode }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex items-center gap-2">
        <label style={{ fontSize: 12, color: 'var(--text3)' }}>Season</label>
        <select value={season} onChange={e => onSeasonChange(Number(e.target.value))} style={ctrlStyle}>
          {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {mode === 'batting' && onMinPaChange && (
        <div className="flex items-center gap-2">
          <label style={{ fontSize: 12, color: 'var(--text3)' }}>Min PA</label>
          <input
            type="number"
            value={minPa ?? 100}
            onChange={e => onMinPaChange(Number(e.target.value))}
            style={{ ...ctrlStyle, width: 80 }}
            min={0} max={700} step={25}
          />
        </div>
      )}

      {mode === 'pitching' && onMinIpChange && (
        <div className="flex items-center gap-2">
          <label style={{ fontSize: 12, color: 'var(--text3)' }}>Min IP</label>
          <input
            type="number"
            value={minIp ?? 40}
            onChange={e => onMinIpChange(Number(e.target.value))}
            style={{ ...ctrlStyle, width: 80 }}
            min={0} max={300} step={10}
          />
        </div>
      )}
    </div>
  )
}
