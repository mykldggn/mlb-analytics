import { useState, ReactNode } from 'react'

interface Tab { label: string; key: string }

interface Props {
  tabs: Tab[]
  defaultTab?: string
  children: (activeKey: string) => ReactNode
  onTabChange?: (key: string) => void
}

export default function TabGroup({ tabs, defaultTab, children, onTabChange }: Props) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key)
  return (
    <div>
      <div className="flex gap-1 border-b border-gray-800 mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setActive(t.key); onTabChange?.(t.key) }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              active === t.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="animate-fade-in">{children(active)}</div>
    </div>
  )
}
