import { useQuery } from '@tanstack/react-query'
import { fetchPitchingStats, fetchPitchingTrend, fetchPitchMovement, fetchCareerPitchingStats } from '../api/pitching'
import { CURRENT_SEASON } from '../utils/constants'

export function usePitchingStats(playerId: number | undefined, season = CURRENT_SEASON) {
  return useQuery({
    queryKey: ['pitching', playerId, season],
    queryFn: () => fetchPitchingStats(playerId!, season),
    enabled: !!playerId,
  })
}

export function usePitchingTrend(playerId: number | undefined, statKey: string) {
  return useQuery({
    queryKey: ['pitching-trend', playerId, statKey],
    queryFn: () => fetchPitchingTrend(playerId!, statKey),
    enabled: !!playerId && !!statKey,
    staleTime: 60 * 60 * 1000,
  })
}

export function usePitchMovement(playerId: number | undefined, season = CURRENT_SEASON) {
  return useQuery({
    queryKey: ['pitch-movement', playerId, season],
    queryFn: () => fetchPitchMovement(playerId!, season),
    enabled: !!playerId,
  })
}

export function useCareerPitchingStats(playerId: number | undefined) {
  return useQuery({
    queryKey: ['career-pitching', playerId],
    queryFn: () => fetchCareerPitchingStats(playerId!),
    enabled: !!playerId,
    staleTime: 24 * 60 * 60 * 1000,
  })
}
