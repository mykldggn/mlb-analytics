import { get, post } from './client'
import { CURRENT_SEASON } from '../utils/constants'

export const fetchBattingStats = (playerId: number, season: number) =>
  get<Record<string, unknown>>(`/batting/${playerId}/stats/${season}`)

export const fetchBattingTrend = (playerId: number, statKey: string, startSeason = 2015, endSeason = CURRENT_SEASON) =>
  get<{ trend: { season: number; value: number | null }[] }>(`/batting/${playerId}/trend/${statKey}`, { start_season: startSeason, end_season: endSeason })

export const requestStatcastJob = (playerId: number, startDt: string, endDt: string) =>
  post<{ job_id: string; status: string }>(`/batting/${playerId}/statcast`, undefined)

export const fetchSprayChart = (playerId: number, season: number) =>
  get<{ status: string; data?: unknown[]; aggregate?: Record<string, unknown> }>(`/batting/${playerId}/spray-chart/${season}`)

export const fetchCareerBattingStats = (playerId: number) =>
  get<{ year_by_year: Record<string, unknown>[]; career_totals: Record<string, unknown>; fangraphs_id?: number }>(`/batting/${playerId}/career`)
