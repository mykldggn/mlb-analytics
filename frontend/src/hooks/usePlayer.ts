import { useQuery } from '@tanstack/react-query'
import { fetchPlayerProfile, fetchPlayerSplits, fetchPlayerGameLog, fetchPlayerBio } from '../api/players'
import { CURRENT_SEASON } from '../utils/constants'

export function usePlayer(playerId: number | undefined) {
  return useQuery({
    queryKey: ['player', playerId],
    queryFn: () => fetchPlayerProfile(playerId!),
    enabled: !!playerId,
    staleTime: 30 * 60 * 1000,
  })
}

export function usePlayerSplits(playerId: number | undefined, season = CURRENT_SEASON, group = 'hitting') {
  return useQuery({
    queryKey: ['splits', playerId, season, group],
    queryFn: () => fetchPlayerSplits(playerId!, season, group),
    enabled: !!playerId,
  })
}

export function usePlayerBio(playerId: number | undefined) {
  return useQuery({
    queryKey: ['player-bio', playerId],
    queryFn: () => fetchPlayerBio(playerId!),
    enabled: !!playerId,
    staleTime: 24 * 60 * 60 * 1000,
  })
}

export function usePlayerGameLog(playerId: number | undefined, season = CURRENT_SEASON, group = 'hitting') {
  return useQuery({
    queryKey: ['game-log', playerId, season, group],
    queryFn: () => fetchPlayerGameLog(playerId!, season, group),
    enabled: !!playerId,
  })
}
