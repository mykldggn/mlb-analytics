import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatStat } from '../../utils/formatters'
import { STAT_DEFINITIONS } from '../../utils/constants'

interface Point { season: number; value: number | null }

interface Props {
  data: Point[]
  statKey: string
  color?: string
  leagueAvg?: number
}

export default function StatTrendChart({ data, statKey, color = '#3b82f6', leagueAvg }: Props) {
  const def = STAT_DEFINITIONS[statKey]
  const label = def?.label ?? statKey.toUpperCase()
  const valid = data.filter(d => d.value != null)
  if (valid.length === 0) return <p className="text-gray-500 text-sm">No trend data available.</p>

  return (
    <div className="w-full h-56">
      <p className="text-xs text-gray-500 mb-2">{label} by Season</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="season" tick={{ fontSize: 11, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} width={48}
            tickFormatter={(v) => formatStat(statKey, v)} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(v: number) => [formatStat(statKey, v), label]}
          />
          {leagueAvg != null && (
            <ReferenceLine y={leagueAvg} stroke="#4b5563" strokeDasharray="4 4"
              label={{ value: 'Lg Avg', fill: '#6b7280', fontSize: 10 }} />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
