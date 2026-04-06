import {
  RadarChart as ReRadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip,
} from 'recharts'

interface StatPoint { key: string; label: string; percentile: number }

interface Series {
  label: string
  color: string
  data: StatPoint[]
}

interface Props { series: Series[] }

export default function RadarChart({ series }: Props) {
  if (!series.length || !series[0].data.length) return null

  const keys = series[0].data.map(d => d.label)
  const chartData = series[0].data.map((d, i) => {
    const row: Record<string, unknown> = { stat: d.label }
    series.forEach(s => { row[s.label] = s.data[i]?.percentile ?? 0 })
    return row
  })

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ReRadarChart data={chartData}>
          <PolarGrid stroke="#1f2937" />
          <PolarAngleAxis dataKey="stat" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#4b5563' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
            formatter={(v: number) => [`${v}th pctl`]}
          />
          {series.map(s => (
            <Radar
              key={s.label}
              name={s.label}
              dataKey={s.label}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        </ReRadarChart>
      </ResponsiveContainer>
    </div>
  )
}
