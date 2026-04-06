import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get } from '../../api/client'
import LoadingSpinner from '../ui/LoadingSpinner'

interface ZoneCell {
  count: number
  pct: number
}

interface PitchZoneResponse {
  status: string
  message?: string
  total_pitches: number
  grid: ZoneCell[][]
  pitch_types: string[]
  split: string
  pitch_type_filter: string
}

const PITCH_TYPE_LABELS: Record<string, string> = {
  FF: '4-Seam FB', SI: 'Sinker', FC: 'Cutter', SL: 'Slider',
  CU: 'Curveball', KC: 'Knuckle Curve', CH: 'Changeup', FS: 'Splitter',
  ST: 'Sweeper', SV: 'Slurve', KN: 'Knuckleball', EP: 'Eephus',
}

function heatColor(pct: number, max: number): string {
  if (max === 0) return 'rgba(30,41,59,0.5)'
  const t = Math.min(pct / (max * 0.8), 1) // normalize
  if (t < 0.2) return `rgba(30,58,138,${0.3 + t * 1.5})`
  if (t < 0.4) return `rgba(37,99,235,${0.4 + t})`
  if (t < 0.6) return `rgba(234,179,8,${0.5 + t * 0.5})`
  if (t < 0.8) return `rgba(249,115,22,${0.7 + t * 0.3})`
  return `rgba(239,68,68,${0.85 + t * 0.15})`
}

export default function PitchZoneChart({ playerId, season }: { playerId: number; season: number }) {
  const [split, setSplit] = useState<'all' | 'vs_lhb' | 'vs_rhb'>('all')
  const [pitchType, setPitchType] = useState('all')

  const { data, isLoading } = useQuery<PitchZoneResponse>({
    queryKey: ['pitch-zones', playerId, season, split, pitchType],
    queryFn: () => get(`/pitching/${playerId}/pitch-zones/${season}`, { split, pitch_type: pitchType }),
    staleTime: 30 * 60 * 1000,
  })

  const cellSize = 52  // px per cell
  const cols = 5
  const rows = 5
  // Strike zone borders in grid coords (0-indexed from left/bottom)
  // x: -0.71 to 0.71 ft → roughly cells 1.32 to 3.68 of 5 (edges at -1.5+n*0.6)
  // z: 1.5 to 3.5 ft → roughly rows 0.83 to 4.17 of 5 (edges at 1.0+n*0.6)
  const szLeft   = (0.71 + 1.5) / 0.6   // ≈3.68
  const szRight  = (0.71 + 1.5) / 0.6 + (1.42 / 0.6) // wrong, redo properly
  // Strike zone in SVG: center x ±0.71 → x_col = (val + 1.5) / 0.6
  // SZ left x = -0.71 → col 1.317; SZ right x = 0.71 → col 3.683
  // SZ bottom z = 1.5 → row from top = (4.0 - 1.5) / 0.6 = 4.167 (rows are top-to-bottom)
  // SZ top z = 3.5 → row from top = (4.0 - 3.5) / 0.6 = 0.833
  const svgW = cols * cellSize
  const svgH = rows * cellSize
  const szX1 = ((-0.71 + 1.5) / 0.6) * cellSize
  const szX2 = ((0.71 + 1.5) / 0.6) * cellSize
  const szY1 = ((4.0 - 3.5) / 0.6) * cellSize
  const szY2 = ((4.0 - 1.5) / 0.6) * cellSize

  const maxPct = data?.grid
    ? Math.max(...data.grid.flat().map(c => c.pct), 0.01)
    : 0.01

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        {/* Split */}
        <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1">
          {(['all', 'vs_lhb', 'vs_rhb'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSplit(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                split === s ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {s === 'all' ? 'All Batters' : s === 'vs_lhb' ? 'vs LHB' : 'vs RHB'}
            </button>
          ))}
        </div>

        {/* Pitch type */}
        {data?.pitch_types && data.pitch_types.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setPitchType('all')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                pitchType === 'all' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              All Pitches
            </button>
            {data.pitch_types.slice(0, 8).map(pt => (
              <button
                key={pt}
                onClick={() => setPitchType(pt)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  pitchType === pt ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                {PITCH_TYPE_LABELS[pt] ?? pt}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner size="sm" />
      ) : !data || data.status === 'not_cached' ? (
        <div className="text-gray-500 text-sm py-4">
          {data?.message ?? 'Statcast data not available. Load pitcher Statcast data first using the trigger below.'}
        </div>
      ) : data.total_pitches === 0 ? (
        <div className="text-gray-500 text-sm py-4">No pitches found for this filter.</div>
      ) : (
        <div className="flex gap-6 flex-wrap">
          {/* Zone grid */}
          <div className="relative">
            <svg width={svgW} height={svgH} className="rounded-lg overflow-hidden">
              {/* Background */}
              <rect width={svgW} height={svgH} fill="#111827" />

              {/* Heat cells */}
              {data.grid.map((row, ri) =>
                row.map((cell, ci) => (
                  <g key={`${ri}-${ci}`}>
                    <rect
                      x={ci * cellSize}
                      y={ri * cellSize}
                      width={cellSize}
                      height={cellSize}
                      fill={heatColor(cell.pct, maxPct)}
                      stroke="#1f2937"
                      strokeWidth={0.5}
                    />
                    {cell.pct > 0 && (
                      <text
                        x={ci * cellSize + cellSize / 2}
                        y={ri * cellSize + cellSize / 2 + 4}
                        textAnchor="middle"
                        fontSize={11}
                        fill={cell.pct > maxPct * 0.4 ? 'rgba(255,255,255,0.9)' : 'rgba(156,163,175,0.8)'}
                        fontFamily="monospace"
                      >
                        {cell.pct.toFixed(1)}%
                      </text>
                    )}
                  </g>
                ))
              )}

              {/* Strike zone outline */}
              <rect
                x={szX1}
                y={szY1}
                width={szX2 - szX1}
                height={szY2 - szY1}
                fill="none"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth={2}
                strokeDasharray="4 2"
              />

              {/* Home plate indicator (bottom center) */}
              <polygon
                points={`${svgW / 2 - 10},${svgH + 4} ${svgW / 2 + 10},${svgH + 4} ${svgW / 2 + 10},${svgH + 12} ${svgW / 2},${svgH + 18} ${svgW / 2 - 10},${svgH + 12}`}
                fill="#e5e7eb"
                opacity={0.4}
              />
            </svg>

            {/* Axis labels */}
            <div className="text-xs text-gray-600 text-center mt-6">← Inside · Outside →</div>
            <div
              className="absolute text-xs text-gray-600"
              style={{ left: -40, top: svgH / 2 - 30, transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}
            >
              High ↑ · Low ↓
            </div>
          </div>

          {/* Legend & stats */}
          <div className="flex flex-col gap-3 text-xs">
            <div>
              <div className="text-gray-500 mb-1 uppercase tracking-wider text-xs">Heat Scale</div>
              <div className="flex items-center gap-2">
                <div className="flex h-3 w-28 rounded overflow-hidden">
                  {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((t, i) => (
                    <div key={i} className="flex-1" style={{ backgroundColor: heatColor(t * maxPct, maxPct) }} />
                  ))}
                </div>
                <span className="text-gray-600">0% → {maxPct.toFixed(1)}%</span>
              </div>
            </div>
            <div>
              <div className="text-gray-500 uppercase tracking-wider text-xs mb-1">Total Pitches</div>
              <div className="font-mono text-gray-300 text-lg">{data.total_pitches.toLocaleString()}</div>
            </div>
            <div className="text-gray-600 leading-relaxed max-w-[140px]">
              Dashed box = average strike zone. Values = % of all pitches in that cell.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
