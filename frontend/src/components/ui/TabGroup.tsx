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
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border2)', marginBottom: 16 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setActive(t.key); onTabChange?.(t.key) }}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${active === t.key ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1,
              color: active === t.key ? 'var(--accent)' : 'var(--text3)',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="animate-fade-in">{children(active)}</div>
    </div>
  )
}
