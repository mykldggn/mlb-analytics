import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchPlayers, PlayerSearchResult } from '../../api/search'
import { useDebounce } from '../../hooks/useDebounce'

const NAV_LINKS = [
  { to: '/leaderboards', label: 'Leaderboards' },
  { to: '/compare', label: 'Compare' },
  { to: '/park-factors', label: 'Park Factors' },
  { to: '/team-analytics', label: 'Team Analytics' },
  { to: '/contract-value', label: 'Contract Value' },
  { to: '/pitch-zones', label: 'Pitch Zones' },
]

export default function Navbar() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [mobileOpen, setMobileOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [navigate])

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

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors ${isActive ? 'text-blue-400' : 'text-gray-400 hover:text-gray-100'}`

  return (
    <header className="sticky top-0 z-50 bg-[#060a12]/95 backdrop-blur border-b border-gray-800/60 shadow-lg shadow-black/30">
      <div className="container mx-auto px-4 max-w-7xl flex items-center h-14 gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <span className="text-xl group-hover:rotate-12 transition-transform duration-300 inline-block">⚾</span>
          <span className="font-bold text-white tracking-tight">
            <span className="text-blue-400">MLB</span> Analytics
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-5">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink key={to} to={to} className={navLinkClass}>{label}</NavLink>
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
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {open && results && results.length > 0 && (
            <div
              role="listbox"
              className="absolute top-full mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50"
            >
              {results.map((p, idx) => (
                <button
                  key={p.mlbam_id}
                  role="option"
                  aria-selected={idx === selectedIndex}
                  onClick={() => onSelect(p)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-3 w-full px-3 py-2 transition-colors text-left ${
                    idx === selectedIndex ? 'bg-gray-700' : 'hover:bg-gray-800'
                  }`}
                >
                  <img
                    src={p.headshot_url}
                    alt={p.fullName}
                    className="w-8 h-8 rounded-full object-cover bg-gray-700 shrink-0"
                  />
                  <div>
                    <div className="text-sm text-gray-100">{p.fullName}</div>
                    <div className="text-xs text-gray-500">{p.position} · {p.team}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-1.5 shrink-0 text-gray-400 hover:text-gray-100 transition-colors"
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block w-5 h-0.5 bg-current transition-opacity duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-gray-800 bg-[#060a12]/98">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block px-5 py-3 text-sm font-medium border-b border-gray-800/50 transition-colors ${
                  isActive ? 'text-blue-400 bg-blue-950/20' : 'text-gray-300 hover:text-white hover:bg-gray-800/40'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
