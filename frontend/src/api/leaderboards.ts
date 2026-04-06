import { get } from './client'
import { CURRENT_SEASON } from '../utils/constants'

export interface LeaderboardFilters {
  sort_by?: string
  order?: 'asc' | 'desc'
  min_pa?: number
  min_ip?: number
  page?: number
  page_size?: number
}

export const fetchBattingLeaderboard = (season: number, filters: LeaderboardFilters = {}) =>
  get<{ data: unknown[]; total: number; page: number; page_size: number }>(`/leaderboards/batting/${season}`, filters as Record<string, unknown>)

export const fetchPitchingLeaderboard = (season: number, filters: LeaderboardFilters = {}) =>
  get<{ data: unknown[]; total: number; page: number; page_size: number }>(`/leaderboards/pitching/${season}`, filters as Record<string, unknown>)

export const fetchSprintSpeedLeaderboard = (season: number = CURRENT_SEASON) =>
  get<{ data: unknown[] }>(`/leaderboards/sprint-speed/${season}`)
