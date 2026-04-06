import { get } from './client'

export const fetchPlayerProfile = (playerId: number) =>
  get<Record<string, unknown>>(`/players/${playerId}`)

export const fetchPlayerSplits = (playerId: number, season: number, group = 'hitting') =>
  get<{ splits: unknown[]; season: number }>(`/players/${playerId}/splits/${season}`, { group })

export const fetchPlayerGameLog = (playerId: number, season: number, group = 'hitting') =>
  get<{ game_log: unknown[] }>(`/players/${playerId}/game-log/${season}`, { group })

export const fetchPlayerBio = (playerId: number) =>
  get<{
    highSchool?: string
    college?: string
    draftYear?: number
    birthDate?: string
    birthCity?: string
    birthStateProvince?: string
    birthCountry?: string
    mlbDebutDate?: string
    teamHistory?: { team: string; teamName?: string; startYear: string; endYear: string }[]
  }>(`/players/${playerId}/bio`)
