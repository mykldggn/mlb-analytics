import { get } from './client'
import { CURRENT_SEASON } from '../utils/constants'

export interface ParkFactorEntry {
  team_abbr: string
  park_name: string
  batter_pfi: number
  pitcher_pfi: number
  run_factor: number
  hr_factor: number
  babip_factor: number
  k_factor: number
  bb_factor: number
  ev_factor: number
  sample_size: number
  interpretation: string
}

export const fetchParkFactors = (season: number = CURRENT_SEASON) =>
  get<{ season: number; seasons_used?: number[]; parks?: ParkFactorEntry[]; status?: string; message?: string }>(`/park-factors/${season}`)

export const fetchTeamParkFactor = (season: number, teamAbbr: string) =>
  get<ParkFactorEntry>(`/park-factors/${season}/team/${teamAbbr}`)
