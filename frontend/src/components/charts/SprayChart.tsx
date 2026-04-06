import { useState, useMemo } from 'react'
import {
  FIELD_VIEWBOX, OUTFIELD_PATH, INFIELD_DIRT_PATH,
  LEFT_FOUL_LINE, RIGHT_FOUL_LINE, BASES, MOUND, BASE_SIZE,
  hitCoordsToSVG, BB_TYPE_COLORS,
} from '../../utils/fieldCoordinates'

interface HitPoint {
  hc_x: number
  hc_y: number
  bb_type?: string
  events?: string
  launch_speed?: number
  launch_angle?: number
}

interface Props { points: HitPoint[] }

const TYPE_LABELS: Record<string, string> = {
  fly_ball:    'Fly Ball',
  ground_ball: 'Ground Ball',
  line_drive:  'Line Drive',
  popup:       'Pop-up',
}

const OUTCOME_KEYS = ['single', 'double', 'triple', 'home_run', 'field_out', 'other']
const OUTCOME_LABELS: Record<string, string> = {
  single: '1B', double: '2B', triple: '3B', home_run: 'HR', field_out: 'Out', other: 'Other',
}
const OUTCOME_COLORS: Record<string, string> = {
  single: '#34d399', double: '#60a5fa', triple: '#a78bfa', home_run: '#f87171', field_out: '#6b7280', other: '#9ca3af',
}

function BaseSquare({ x, y }: { x: number; y: number }) {
  return <rect x={x - BASE_SIZE / 2} y={y - BASE_SIZE / 2} width={BASE_SIZE} height={BASE_SIZE} fill="#e5e7eb" rx={1} />
}

export default function SprayChart({ points }: Props) {
  const [activeType, setActiveType] = useState<string | null>(null)

  // Compute per-type counts and percentages
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    points.forEach(p => {
      const t = p.bb_type ?? 'unknown'
      counts[t] = (counts[t] ?? 0) + 1
    })
    return counts
  }, [points])

  // Compute per-outcome counts
  const outcomeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    points.forEach(p => {
      const ev = p.events ?? 'other'
      const key = OUTCOME_KEYS.includes(ev) ? ev : 'other'
      counts[key] = (counts[key] ?? 0) + 1
    })
    return counts
  }, [points])

  const total = points.length
  const visiblePoints = activeType ? points.filter(p => p.bb_type === activeType) : points

  // BA / SLG on visible points
  const { hits, tb } = useMemo(() => {
    let h = 0, t = 0
    visiblePoints.forEach(p => {
      const ev = p.events ?? ''
      if (ev === 'single')    { h++; t += 1 }
      else if (ev === 'double')  { h++; t += 2 }
      else if (ev === 'triple')  { h++; t += 3 }
      else if (ev === 'home_run') { h++; t += 4 }
    })
    const abs = visiblePoints.filter(p => !['walk', 'hit_by_pitch', 'sac_fly', 'sac_bunt'].includes(p.events ?? '')).length
    return { hits: h, tb: t, abs }
  }, [visiblePoints])

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Field */}
        <div className="w-full max-w-lg mx-auto lg:mx-0 shrink-0">
          <svg viewBox={FIELD_VIEWBOX} className="w-full h-auto">
            <rect width="600" height="450" fill="#1a2e1a" />
            <path d={OUTFIELD_PATH} fill="#1e3a1e" stroke="#2d4a2d" strokeWidth={1} />
            <path d={INFIELD_DIRT_PATH} fill="#3d2b1a" />
            <path d={LEFT_FOUL_LINE}  stroke="#4b5563" strokeWidth={1} strokeDasharray="4 4" />
            <path d={RIGHT_FOUL_LINE} stroke="#4b5563" strokeWidth={1} strokeDasharray="4 4" />
            <BaseSquare x={BASES.first.x}  y={BASES.first.y} />
            <BaseSquare x={BASES.second.x} y={BASES.second.y} />
            <BaseSquare x={BASES.third.x}  y={BASES.third.y} />
            <polygon points="300,438 293,431 293,423 307,423 307,431" fill="#e5e7eb" />
            <circle cx={MOUND.x} cy={MOUND.y} r={MOUND.r} fill="#5a3e22" />
            {visiblePoints.map((p, i) => {
              const { x, y } = hitCoordsToSVG(p.hc_x, p.hc_y)
              const color = BB_TYPE_COLORS[p.bb_type ?? ''] ?? '#60a5fa'
              const isHR = p.events === 'home_run'
              return (
                <circle key={i} cx={x} cy={y} r={isHR ? 4.5 : 3}
                  fill={color} fillOpacity={0.75}
                  stroke={isHR ? '#fff' : 'none'} strokeWidth={isHR ? 0.75 : 0}>
                  <title>{p.events?.replace(/_/g, ' ')} — EV: {p.launch_speed?.toFixed(0)} mph, LA: {p.launch_angle?.toFixed(0)}°</title>
                </circle>
              )
            })}
          </svg>
        </div>

        {/* Stats panel */}
        <div className="flex flex-col gap-4 min-w-[180px]">
          {/* Hit type filter */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Hit Type</div>
            <div className="space-y-1.5">
              {Object.entries(BB_TYPE_COLORS).map(([type, color]) => {
                const count = typeCounts[type] ?? 0
                const pct = total > 0 ? (count / total * 100) : 0
                const isActive = activeType === type
                return (
                  <button
                    key={type}
                    onClick={() => setActiveType(isActive ? null : type)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      isActive ? 'bg-gray-700 ring-1 ring-gray-500' : 'hover:bg-gray-800/60'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-gray-300 flex-1 text-left">{TYPE_LABELS[type] ?? type}</span>
                    <span className="text-gray-400 font-mono">{count}</span>
                    <span className="text-gray-600 font-mono w-9 text-right">{pct.toFixed(1)}%</span>
                  </button>
                )
              })}
              {activeType && (
                <button onClick={() => setActiveType(null)}
                  className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors pt-0.5">
                  Clear filter
                </button>
              )}
            </div>
          </div>

          {/* Outcome breakdown */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Outcomes</div>
            <div className="space-y-1">
              {OUTCOME_KEYS.filter(k => (outcomeCounts[k] ?? 0) > 0).map(key => {
                const count = outcomeCounts[key] ?? 0
                const pct = total > 0 ? (count / total * 100) : 0
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: OUTCOME_COLORS[key] }} />
                    <span className="text-gray-400 w-8">{OUTCOME_LABELS[key]}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: OUTCOME_COLORS[key] }} />
                    </div>
                    <span className="text-gray-500 font-mono w-7 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick rate stats for visible points */}
          <div className="border-t border-gray-800 pt-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              {activeType ? TYPE_LABELS[activeType] : 'All'} — {visiblePoints.length} BIP
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-gray-500">Hits</span>
              <span className="text-gray-300 font-mono text-right">{hits}</span>
              <span className="text-gray-500">Total Bases</span>
              <span className="text-gray-300 font-mono text-right">{tb}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
