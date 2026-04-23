import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchPlayers, PlayerSearchResult } from '../../api/search'
import { useDebounce } from '../../hooks/useDebounce'

const NAV_LINKS = [
  { to: '/leaderboards',   label: 'Leaderboards' },
  { to: '/compare',        label: 'Compare' },
  { to: '/park-factors',   label: 'Park Factors' },
  { to: '/team-analytics', label: 'Team Analytics' },
  { to: '/contract-value', label: 'Contract Value' },
  { to: '/pitch-zones',    label: 'Pitch Zones' },
]

export default function Navbar() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const { data: results } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchPlayers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  })

  useEffect(() => {
    setOpen(!!results?.length && query.length >= 2)
    setSelectedIndex(-1)
  }, [results, query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [navigate])

  function onSelect(player: PlayerSearchResult) {
    setQuery('')
    setOpen(false)
    setSelectedIndex(-1)
    navigate(`/players/${player.mlbam_id}`)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !results?.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = selectedIndex >= 0 ? results[selectedIndex] : results[0]
      if (target) onSelect(target)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setSelectedIndex(-1)
    }
  }, [open, results, selectedIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const navBg = scrolled
    ? 'rgba(8, 17, 31, 0.96)'
    : 'var(--bg2)'

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur"
      style={{
        background: navBg,
        borderBottom: '1px solid var(--border2)',
        boxShadow: scrolled ? '0 2px 12px rgba(0,25,80,0.10)' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
        /* Subtle pinstripe on nav */
        backgroundImage: scrolled
          ? undefined
          : `repeating-linear-gradient(90deg, transparent 20px, rgba(255,255,255,0.013) 20px, rgba(255,255,255,0.013) 21px)`,
      }}
    >
      <div className="container mx-auto px-4 max-w-7xl flex items-center h-16 gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <img
            src="/mlb-logo.png"
            alt="MLB"
            style={{ width: 48, height: 33, objectFit: 'contain' }}
          />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}>
            <span style={{ color: scrolled ? '#eef2ff' : 'var(--text)' }}>MLB </span><span style={{ color: 'var(--accent2)', fontStyle: 'italic' }}>Analytics</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                fontSize: 13,
                fontWeight: 500,
                color: isActive ? 'var(--accent)' : (scrolled ? '#8095b8' : 'var(--text2)'),
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                paddingBottom: 2,
                transition: 'color 0.15s, border-color 0.15s',
                textDecoration: 'none',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Search */}
        <div ref={ref} className="relative ml-auto w-56 md:w-64">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search players..."
            aria-label="Search players"
            aria-expanded={open}
            aria-autocomplete="list"
            style={{
              width: '100%',
              background: 'white',
              border: '1px solid var(--border2)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              color: 'var(--text)',
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent2)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border2)' }}
          />
          {open && results && results.length > 0 && (
            <div
              role="listbox"
              className="absolute top-full mt-1 w-full rounded-xl shadow-xl overflow-hidden z-50"
              style={{ background: 'white', border: '1px solid var(--border2)' }}
            >
              {results.map((p, idx) => (
                <button
                  key={p.mlbam_id}
                  role="option"
                  aria-selected={idx === selectedIndex}
                  onClick={() => onSelect(p)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className="flex items-center gap-3 w-full px-3 py-2 text-left transition-colors"
                  style={{
                    background: idx === selectedIndex ? 'var(--surface2)' : 'transparent',
                    color: 'var(--text)',
                  }}
                >
                  <img
                    src={p.headshot_url}
                    alt={p.fullName}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                    style={{ background: 'var(--bg3)' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{p.fullName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.position} · {p.team}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-1.5 shrink-0 transition-colors"
          style={{ color: scrolled ? '#8095b8' : 'var(--text2)' }}
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block w-5 h-0.5 bg-current transition-opacity duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({
                display: 'block',
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 500,
                borderBottom: '1px solid var(--border)',
                color: isActive ? 'var(--accent)' : 'var(--text2)',
                background: isActive ? 'rgba(184,0,26,0.05)' : 'transparent',
                textDecoration: 'none',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
