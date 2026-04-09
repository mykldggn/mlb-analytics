import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

const PITCH_COLORS: Record<string, string> = {
  FF: '#ef4444',  // Four-seam FB — red
  SI: '#f97316',  // Sinker — orange
  FC: '#f59e0b',  // Cutter — amber
  SL: '#3b82f6',  // Slider — blue
  CU: '#8b5cf6',  // Curveball — purple
  CH: '#10b981',  // Changeup — green
  FS: '#06b6d4',  // Splitter — cyan
  KC: '#6366f1',  // Knuckle-curve — indigo
  SV: '#ec4899',  // Sweeper — pink
  ST: '#84cc16',  // Sweeping curve — lime
  KN: '#9ca3af',  // Knuckleball — gray
}

interface PitchPoint {
  pitch_type_code: string
  break_x?: number
  break_z?: number
  avg_speed?: number
}

interface Props { pitches: PitchPoint[] }

export default function PitchMovementPlot({ pitches }: Props) {
  if (!pitches.length) return <p className="text-gray-500 text-sm">No pitch movement data.</p>

  const points = pitches.filter(p => p.break_x != null && p.break_z != null)
  if (!points.length) return <p className="text-gray-500 text-sm">No movement data available.</p>

  const data = points.map(p => ({
    x: p.break_x!,
    y: p.break_z!,
    type: p.pitch_type_code,
    speed: p.avg_speed,
  }))

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">Pitch Movement (inches, pitcher perspective)</p>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              type="number" dataKey="x" domain={[-25, 25]}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              label={{ value: '← Glove side · Arm side →', position: 'insideBottom', offset: -2, fill: '#4b5563', fontSize: 10 }}
            />
            <YAxis
              type="number" dataKey="y" domain={[-20, 20]}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              label={{ value: 'Vertical Break', angle: -90, position: 'insideLeft', fill: '#4b5563', fontSize: 10 }}
            />
            <ReferenceLine x={0} stroke="#374151" />
            <ReferenceLine y={0} stroke="#374151" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(_val, _name, props) => {
                const { payload } = props
                return [`${payload.type} — H: ${payload.x}″, V: ${payload.y}″, ${payload.speed?.toFixed(1)} mph`, '']
              }}
            />
            <Scatter data={data} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={index} fill={PITCH_COLORS[entry.type] ?? '#9ca3af'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {/* Pitch type legend */}
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {points.map(p => (
          <span key={p.pitch_type_code} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: PITCH_COLORS[p.pitch_type_code] ?? '#9ca3af' }} />
            {p.pitch_type_code}
          </span>
        ))}
      </div>
    </div>
  )
}
