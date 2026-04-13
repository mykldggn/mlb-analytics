import { useState, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  content?: string
  children: ReactNode
}

export default function Tooltip({ content, children }: Props) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)

  if (!content) return <>{children}</>

  function handleMouseEnter() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setCoords({
        top: rect.top,                    // fixed: relative to viewport
        left: rect.left + rect.width / 2, // center of trigger
      })
    }
    setVisible(true)
  }

  return (
    <span
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && createPortal(
        <div
          style={{
            position: 'fixed',
            top: coords.top - 8,
            left: coords.left,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
          }}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg px-3 py-2 w-56 shadow-xl pointer-events-none"
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>,
        document.body
      )}
    </span>
  )
}
