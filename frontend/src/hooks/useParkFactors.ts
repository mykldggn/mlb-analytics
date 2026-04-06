import { useQuery } from '@tanstack/react-query'
import { fetchParkFactors } from '../api/parkFactors'
import { CURRENT_SEASON } from '../utils/constants'

export function useParkFactors(season = CURRENT_SEASON) {
  return useQuery({
    queryKey: ['park-factors', season],
    queryFn: () => fetchParkFactors(season),
    staleTime: 60 * 60 * 1000,
    // Auto-poll every 12 seconds while the backend is computing PFI
    refetchInterval: (query) =>
      (query.state.data as Record<string, unknown> | undefined)?.status === 'computing'
        ? 12_000
        : false,
  })
}
