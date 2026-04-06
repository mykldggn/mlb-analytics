interface Props { size?: 'sm' | 'md' | 'lg'; label?: string }

export default function LoadingSpinner({ size = 'md', label }: Props) {
  const dim = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-7 h-7'
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className={`${dim} border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin`} />
      {label && <span className="text-sm text-gray-500">{label}</span>}
    </div>
  )
}
