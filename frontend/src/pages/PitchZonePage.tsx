import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { searchPlayers, PlayerSearchResult } from '../api/search'
import { useDebounce } from '../hooks/useDebounce'
import { CURRENT_SEASON } from '../utils/constants'
import PitchZoneChart from '../components/charts/PitchZoneChart'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const SEASONS = Array.from({ length: 11 }, (_, i) => CURRENT_SEASON - i)

export default function PitchZonePage() {
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedPitcher, setSelectedPitcher] = useState<PlayerSearchResult | null>(null)
  const [season, setSeason] = useState(CURRENT_SEASON)
  const debouncedQuery = useDebounce(query, 300)

  const { data: results } = useQuery({
    queryKey: ['search-pitcher', debouncedQuery],
    queryFn: () => searchPlayers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  })

  function onSelect(player: PlayerSearchResult) {
    setSelectedPitcher(player)
    setQuery('')
    setDropdownOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Pitch Zone Chart</h1>
        <p className="text-gray-500 text-sm mt-1 max-w-2xl">
          Pitch location frequency heatmap — where pitchers throw by pitch type and batter handedness.
          Requires Statcast data to be loaded for the selected pitcher and season.
        </p>
      </div>

      {/* Pitcher search + season selector */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative w-72">
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setDropdownOpen(true) }}
            placeholder="Search pitcher..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {dropdownOpen && results && results.length > 0 && (
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
                    className="w-7 h-7 rounded-full object-cover bg-gray-700 shrink-0"
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

        <select
          value={season}
          onChange={e => setSeason(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        >
          {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Content */}
      {!selectedPitcher ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-gray-400">Search for a pitcher to view their pitch zone chart.</p>
          <p className="text-xs text-gray-600 mt-2">
            Pitch zone data requires Statcast data to be pre-loaded via the pitcher's profile page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pitcher info header */}
          <div className="flex items-center gap-4">
            <img
              src={selectedPitcher.headshot_url}
              alt={selectedPitcher.fullName}
              className="w-12 h-12 rounded-full object-cover bg-gray-800"
            />
            <div>
              <Link
                to={`/players/${selectedPitcher.mlbam_id}`}
                className="text-lg font-semibold text-white hover:text-blue-400 transition-colors"
              >
                {selectedPitcher.fullName}
              </Link>
              <div className="text-sm text-gray-500">{selectedPitcher.position} · {selectedPitcher.team} · {season}</div>
            </div>
          </div>

          {/* Pitch zone chart */}
          <div className="card">
            <PitchZoneChart playerId={selectedPitcher.mlbam_id} season={season} />
          </div>

          {/* Note about Statcast data */}
          <div className="card border-amber-900/30 bg-amber-950/10">
            <p className="text-xs text-amber-400/80">
              Pitch zone charts require Statcast data to be loaded first. If you see "data not cached," visit{' '}
              <Link to={`/players/${selectedPitcher.mlbam_id}`} className="underline hover:text-amber-300">
                {selectedPitcher.fullName}'s profile
              </Link>
              {' '}and trigger a Statcast data pull from the Charts tab.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
