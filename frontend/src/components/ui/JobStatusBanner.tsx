interface Props {
  status: string | null
  progress: number
  error?: string | null
}

export default function JobStatusBanner({ status, progress, error }: Props) {
  if (!status || status === 'complete') return null
  if (status === 'error') {
    return (
      <div className="bg-red-900/40 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400">
        Failed to load Statcast data: {error ?? 'Unknown error'}
      </div>
    )
  }
  return (
    <div className="bg-blue-900/30 border border-blue-800 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-blue-300">Loading Statcast data… (up to 30s)</span>
        <span className="text-xs text-blue-500">{progress}%</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
