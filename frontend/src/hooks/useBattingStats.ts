import { useQuery } from '@tanstack/react-query'
import { fetchBattingStats, fetchBattingTrend, fetchSprayChart, fetchCareerBattingStats } from '../api/batting'
import { CURRENT_SEASON } from '../utils/constants'

export function useBattingStats(playerId: number | undefined, season = CURRENT_SEASON) {
  return useQuery({
    queryKey: ['batting', playerId, season],
    queryFn: () => fetchBattingStats(playerId!, season),
    enabled: !!playerId,
  })
}

export function useBattingTrend(playerId: number | undefined, statKey: string) {
  return useQuery({
    queryKey: ['batting-trend', playerId, statKey],
    queryFn: () => fetchBattingTrend(playerId!, statKey),
    enabled: !!playerId && !!statKey,
    staleTime: 60 * 60 * 1000,
  })
}

export function useSprayChart(playerId: number | undefined, season = CURRENT_SEASON) {
  return useQuery({
    queryKey: ['spray-chart', playerId, season],
    queryFn: () => fetchSprayChart(playerId!, season),
    enabled: !!playerId,
    staleTime: 60 * 60 * 1000,
  })
}

export function useCareerBattingStats(playerId: number | undefined) {
  return useQuery({
    queryKey: ['career-batting', playerId],
    queryFn: () => fetchCareerBattingStats(playerId!),
    enabled: !!playerId,
    staleTime: 24 * 60 * 60 * 1000,
  })
}
