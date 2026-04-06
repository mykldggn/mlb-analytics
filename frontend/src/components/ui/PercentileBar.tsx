interface Props {
  percentile: number
  label?: string
  showValue?: boolean
}

function pctColor(p: number) {
  if (p >= 80) return '#34d399'
  if (p >= 60) return '#4ade80'
  if (p >= 40) return '#d1d5db'
  if (p >= 20) return '#fbbf24'
  return '#ef4444'
}

export default function PercentileBar({ percentile, label, showValue = true }: Props) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>}
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentile}%`, backgroundColor: pctColor(percentile) }}
        />
      </div>
      {showValue && (
        <span className="text-xs font-mono w-10 text-right" style={{ color: pctColor(percentile) }}>
          {percentile}
        </span>
      )}
    </div>
  )
}
