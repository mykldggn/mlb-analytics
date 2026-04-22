import { STAT_DEFINITIONS } from '../../utils/constants'
import { formatStat } from '../../utils/formatters'
import Tooltip from './Tooltip'

interface Props {
  statKey: string
  value: number | null | undefined
  label?: string
  delta?: number
  percentile?: number
  size?: 'sm' | 'md' | 'lg'
}

export default function StatCard({ statKey, value, label, delta, percentile, size = 'md' }: Props) {
  const def = STAT_DEFINITIONS[statKey]
  const displayLabel = label ?? def?.label ?? statKey.toUpperCase()
  const formatted = formatStat(statKey, value)

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  }

  return (
    <div className={`card flex flex-col gap-1 ${sizeClasses[size]}`}>
      <Tooltip content={def?.description}>
        <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'help' }}>{displayLabel}</span>
      </Tooltip>
      <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: size === 'lg' ? '1.875rem' : size === 'md' ? '1.5rem' : '1.125rem', color: 'var(--text)' }}>
        {formatted}
      </span>
      {delta != null && (
        <span className={`text-xs ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {delta >= 0 ? '+' : ''}{formatStat(statKey, delta)} vs prev
        </span>
      )}
      {percentile != null && (
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg3)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${percentile}%`, backgroundColor: percentileColor(percentile) }}
            />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{percentile}p</span>
        </div>
      )}
    </div>
  )
}

function percentileColor(p: number): string {
  if (p >= 80) return '#34d399'
  if (p >= 60) return '#4ade80'
  if (p >= 40) return '#d1d5db'
  if (p >= 20) return '#fbbf24'
  return '#ef4444'
}
