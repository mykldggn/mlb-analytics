import { SEASONS } from '../../utils/constants'

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
        <label className="text-xs text-gray-500">Season</label>
        <select
          value={season}
          onChange={e => onSeasonChange(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        >
          {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {mode === 'batting' && onMinPaChange && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Min PA</label>
          <input
            type="number"
            value={minPa ?? 100}
            onChange={e => onMinPaChange(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-gray-200 w-20 focus:outline-none focus:border-blue-500"
            min={0} max={700} step={25}
          />
        </div>
      )}

      {mode === 'pitching' && onMinIpChange && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Min IP</label>
          <input
            type="number"
            value={minIp ?? 40}
            onChange={e => onMinIpChange(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-gray-200 w-20 focus:outline-none focus:border-blue-500"
            min={0} max={300} step={10}
          />
        </div>
      )}
    </div>
  )
}
