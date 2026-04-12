import { get } from './client'

export interface StandingsEntry {
  team_name: string
  w: number
  l: number
  win_pct: number
  run_diff: number
  rs: number
  ra: number
}

export interface TeamAnalyticsResponse {
  season: number
  batting: Record<string, unknown>[]
  pitching: Record<string, unknown>[]
  standings: Record<string, StandingsEntry>
  errors?: string[]
}

export const fetchTeamAnalytics = (season: number) =>
  get<TeamAnalyticsResponse>(`/teams/analytics/${season}`)

export const fetchTeamAnalyticsAll = () =>
  get<TeamAnalyticsResponse>(`/teams/analytics/all`)
