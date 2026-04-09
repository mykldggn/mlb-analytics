import { get, post } from './client'
import { CURRENT_SEASON } from '../utils/constants'

export const fetchPitchingStats = (playerId: number, season: number) =>
  get<Record<string, unknown>>(`/pitching/${playerId}/stats/${season}`)

export const fetchPitchingTrend = (playerId: number, statKey: string, startSeason = 2015, endSeason = CURRENT_SEASON) =>
  get<{ trend: { season: number; value: number | null }[] }>(`/pitching/${playerId}/trend/${statKey}`, { start_season: startSeason, end_season: endSeason })

export const requestPitcherStatcastJob = (playerId: number, _startDt: string, _endDt: string) =>
  post<{ job_id: string; status: string }>(`/pitching/${playerId}/statcast`, undefined)

export const fetchPitchMovement = (playerId: number, season: number) =>
  get<{ status: string; arsenal?: unknown[] }>(`/pitching/${playerId}/pitch-movement/${season}`)

export const fetchCareerPitchingStats = (playerId: number) =>
  get<{ year_by_year: Record<string, unknown>[]; career_totals: Record<string, unknown>; fangraphs_id?: number }>(`/pitching/${playerId}/career`)
