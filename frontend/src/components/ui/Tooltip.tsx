import { useState, ReactNode } from 'react'

interface Props {
  content?: string
  children: ReactNode
}

export default function Tooltip({ content, children }: Props) {
  const [visible, setVisible] = useState(false)
  if (!content) return <>{children}</>
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg px-3 py-2 w-56 shadow-xl pointer-events-none">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </span>
  )
}
