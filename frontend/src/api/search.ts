import { get } from './client'

export interface PlayerSearchResult {
  mlbam_id: number
  fullName: string
  position?: string
  team?: string
  headshot_url: string
  active?: boolean
}

export const searchPlayers = (q: string) =>
  get<PlayerSearchResult[]>('/search/players', { q })
