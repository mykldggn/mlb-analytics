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
  const t = Math.min(pct / (max * 0.8), 1)
  if (t < 0.2) return `rgba(30,58,138,${0.3 + t * 1.5})`
  if (t < 0.4) return `rgba(37,99,235,${0.4 + t})`
  if (t < 0.6) return `rgba(234,179,8,${0.5 + t * 0.5})`
  if (t < 0.8) return `rgba(249,115,22,${0.7 + t * 0.3})`
  return `rgba(239,68,68,${0.85 + t * 0.15})`
}

const SPLITS = [
  { key: 'all' as const,     label: 'All Batters' },
  { key: 'vs_lhb' as const,  label: 'vs LHB' },
  { key: 'vs_rhb' as const,  label: 'vs RHB' },
]

export default function PitchZoneChart({ playerId, season }: { playerId: number; season: number }) {
  const [split, setSplit] = useState<'all' | 'vs_lhb' | 'vs_rhb'>('all')
  const [pitchType, setPitchType] = useState('all')

  const { data, isLoading } = useQuery<PitchZoneResponse>({
    queryKey: ['pitch-zones', playerId, season, split, pitchType],
    queryFn: () => get(`/pitching/${playerId}/pitch-zones/${season}`, { split, pitch_type: pitchType }),
    staleTime: 30 * 60 * 1000,
  })

  const cellSize = 52
  const cols = 5, rows = 5
  const svgW = cols * cellSize
  const svgH = rows * cellSize
  const szX1 = ((-0.71 + 1.5) / 0.6) * cellSize
  const szX2 = ((0.71 + 1.5) / 0.6) * cellSize
  const szY1 = ((4.0 - 3.5) / 0.6) * cellSize
  const szY2 = ((4.0 - 1.5) / 0.6) * cellSize

  const maxPct = data?.grid
    ? Math.max(...data.grid.flat().map(c => c.pct), 0.01)
    : 0.01

  const HEAT_LEGEND = [
    { t: 0.08, label: 'Low frequency' },
    { t: 0.32, label: 'Below average' },
    { t: 0.55, label: 'Average' },
    { t: 0.78, label: 'High' },
    { t: 1.00, label: `Peak (${maxPct.toFixed(1)}%)` },
  ]

  const btnBase: React.CSSProperties = {
    cursor: 'pointer', transition: 'all 0.12s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Row 1 — split selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SPLITS.map(({ key, label }) => {
          const active = split === key
          return (
            <button
              key={key}
              onClick={() => setSplit(key)}
              style={{
                ...btnBase,
                padding: '6px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: active ? 'var(--accent2)' : 'transparent',
                color: active ? 'white' : 'var(--text2)',
                border: `1px solid ${active ? 'var(--accent2)' : 'var(--border2)'}`,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Row 2 — pitch type selector */}
      {data?.pitch_types && data.pitch_types.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(['all', ...data.pitch_types.slice(0, 8)] as string[]).map(pt => {
            const active = pitchType === pt
            const label = pt === 'all' ? 'All Pitches' : (PITCH_TYPE_LABELS[pt] ?? pt)
            return (
              <button
                key={pt}
                onClick={() => setPitchType(pt)}
                style={{
                  ...btnBase,
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  background: active ? 'var(--bg3)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text3)',
                  border: `1px solid ${active ? 'var(--border2)' : 'var(--border)'}`,
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner size="sm" />
      ) : !data || data.status === 'not_cached' ? (
        <div style={{ color: 'var(--text3)', fontSize: 14, padding: '16px 0' }}>
          {data?.message ?? 'Statcast data not available. Load pitcher Statcast data first.'}
        </div>
      ) : data.total_pitches === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 14, padding: '16px 0' }}>No pitches found for this filter.</div>
      ) : (
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Strike zone grid */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'var(--text3)',
              textAlign: 'center', marginBottom: 10,
            }}>
              Strike Zone (Catcher's View)
            </div>
            <div style={{
              background: 'rgba(0,25,80,0.05)',
              border: '1px solid var(--border2)',
              borderRadius: 10, padding: 10,
              display: 'inline-block',
            }}>
              <svg width={svgW} height={svgH} style={{ display: 'block', borderRadius: 4 }}>
                <rect width={svgW} height={svgH} fill="#111827" />
                {data.grid.map((row, ri) =>
                  row.map((cell, ci) => (
                    <g key={`${ri}-${ci}`}>
                      <rect
                        x={ci * cellSize} y={ri * cellSize}
                        width={cellSize} height={cellSize}
                        fill={heatColor(cell.pct, maxPct)}
                        stroke="#1f2937" strokeWidth={0.5}
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
                <rect
                  x={szX1} y={szY1}
                  width={szX2 - szX1} height={szY2 - szY1}
                  fill="none"
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                />
              </svg>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>
              ← Inside · Outside →
            </div>
          </div>

          {/* Legend + stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 30 }}>

            {/* Heat scale — discrete swatches */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 10 }}>
                Heat Scale
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {HEAT_LEGEND.map(({ t, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                      background: heatColor(t * maxPct, maxPct),
                      border: '1px solid rgba(0,0,0,0.12)',
                    }} />
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total pitches */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 4 }}>
                Total Pitches
              </div>
              <div style={{ fontSize: 32, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                {data.total_pitches.toLocaleString()}
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 160, lineHeight: 1.65 }}>
              Dashed box = average strike zone. Values = % of all pitches in that cell.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
