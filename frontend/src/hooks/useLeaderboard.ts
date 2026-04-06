import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchBattingLeaderboard, fetchPitchingLeaderboard, LeaderboardFilters } from '../api/leaderboards'
import { CURRENT_SEASON } from '../utils/constants'

export function useBattingLeaderboard(season = CURRENT_SEASON, initialFilters: LeaderboardFilters = {}) {
  const [filters, setFilters] = useState<LeaderboardFilters>({ sort_by: 'war', order: 'desc', min_pa: 100, page: 1, page_size: 50, ...initialFilters })

  const query = useQuery({
    queryKey: ['leaderboard', 'batting', season, filters],
    queryFn: () => fetchBattingLeaderboard(season, filters),
    placeholderData: keepPreviousData,
  })

  return { ...query, filters, setFilters }
}

export function usePitchingLeaderboard(season = CURRENT_SEASON, initialFilters: LeaderboardFilters = {}) {
  const [filters, setFilters] = useState<LeaderboardFilters>({ sort_by: 'war', order: 'desc', min_ip: 40, page: 1, page_size: 50, ...initialFilters })

  const query = useQuery({
    queryKey: ['leaderboard', 'pitching', season, filters],
    queryFn: () => fetchPitchingLeaderboard(season, filters),
    placeholderData: keepPreviousData,
  })

  return { ...query, filters, setFilters }
}
