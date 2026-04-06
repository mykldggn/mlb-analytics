import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchPlayers, PlayerSearchResult } from '../../api/search'
import { useDebounce } from '../../hooks/useDebounce'

export default function Navbar() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [open, setOpen] = useState(false)
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
  }, [results, query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function onSelect(player: PlayerSearchResult) {
    setQuery('')
    setOpen(false)
    navigate(`/players/${player.mlbam_id}`)
  }

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

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-5">
          <NavLink to="/leaderboards" className={navLinkClass}>Leaderboards</NavLink>
          <NavLink to="/compare" className={navLinkClass}>Compare</NavLink>
          <NavLink to="/park-factors" className={navLinkClass}>Park Factors</NavLink>
          <NavLink to="/team-analytics" className={navLinkClass}>Team Analytics</NavLink>
          <NavLink to="/contract-value" className={navLinkClass}>Contract Value</NavLink>
          <NavLink to="/pitch-zones" className={navLinkClass}>Pitch Zones</NavLink>
        </nav>

        {/* Search */}
        <div ref={ref} className="relative ml-auto w-64">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search players..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {open && results && results.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
              {results.map(p => (
                <button
                  key={p.mlbam_id}
                  onClick={() => onSelect(p)}
                  className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-800 transition-colors text-left"
                >
                  <img
                    src={p.headshot_url}
                    alt={p.fullName}
                    className="w-8 h-8 rounded-full object-cover bg-gray-700"
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
      </div>
    </header>
  )
}
