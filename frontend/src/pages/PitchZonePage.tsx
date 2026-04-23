import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { searchPlayers, PlayerSearchResult } from '../api/search'
import { useDebounce } from '../hooks/useDebounce'
import { CURRENT_SEASON } from '../utils/constants'
import { post, get } from '../api/client'
import PitchZoneChart from '../components/charts/PitchZoneChart'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const SEASONS = Array.from({ length: 11 }, (_, i) => CURRENT_SEASON - i)

export default function PitchZonePage() {
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedPitcher, setSelectedPitcher] = useState<PlayerSearchResult | null>(null)
  const [season, setSeason] = useState(CURRENT_SEASON)
  const [triggering, setTriggering] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const queryClient = useQueryClient()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: results } = useQuery({
    queryKey: ['search-pitcher', debouncedQuery],
    queryFn: () => searchPlayers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  })

  // Check current Statcast status for selected pitcher
  const { data: zoneStatus } = useQuery<{ status: string }>({
    queryKey: ['pitch-zones', selectedPitcher?.mlbam_id, season, 'all', 'all'],
    queryFn: () => get(`/pitching/${selectedPitcher!.mlbam_id}/pitch-zones/${season}`, { split: 'all', pitch_type: 'all' }),
    enabled: !!selectedPitcher,
    staleTime: 0, // always recheck when pitcher/season changes
  })

  // Auto-trigger Statcast load when pitcher selected and data not cached
  useEffect(() => {
    if (!selectedPitcher || !zoneStatus) return
    if (zoneStatus.status !== 'not_cached') return

    async function triggerAndPoll() {
      if (!selectedPitcher) return
      setTriggering(true)
      try {
        const start = `${season}-03-20`
        const end = `${season}-11-01`
        await post(`/pitching/${selectedPitcher.mlbam_id}/statcast?start_dt=${start}&end_dt=${end}`)
      } catch { /* ignore — job may already exist */ }

      // Poll every 8 seconds until data is ready
      pollRef.current = setInterval(async () => {
        if (!selectedPitcher) return
        await queryClient.refetchQueries({
          queryKey: ['pitch-zones', selectedPitcher.mlbam_id, season, 'all', 'all'],
        })
        const current = queryClient.getQueryData(['pitch-zones', selectedPitcher.mlbam_id, season, 'all', 'all']) as { status?: string } | undefined
        if (current?.status === 'ready') {
          clearInterval(pollRef.current!)
          setTriggering(false)
        }
      }, 8_000)

      // Stop polling after 3 minutes
      setTimeout(() => {
        if (pollRef.current) { clearInterval(pollRef.current); setTriggering(false) }
      }, 180_000)
    }

    triggerAndPoll()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [selectedPitcher?.mlbam_id, season, zoneStatus?.status])

  function onSelect(player: PlayerSearchResult) {
    setSelectedPitcher(player)
    setQuery('')
    setDropdownOpen(false)
    setTriggering(false)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)' }}>Pitch Zone Chart</h1>
        <p className="text-gray-500 text-sm mt-1 max-w-2xl">
          Pitch location frequency heatmap — where pitchers throw by pitch type and batter handedness.
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
            style={{ width: '100%', background: 'white', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
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
          style={{ background: 'white', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
        >
          {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Content */}
      {!selectedPitcher ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">Search for a pitcher to view their pitch zone chart.</p>
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

          {triggering ? (
            <div className="card flex items-center gap-3 py-6">
              <LoadingSpinner size="sm" />
              <span className="text-sm text-gray-400">Loading Statcast data for {selectedPitcher.fullName}… this takes ~30–60 seconds.</span>
            </div>
          ) : (
            <div className="card">
              <PitchZoneChart playerId={selectedPitcher.mlbam_id} season={season} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
