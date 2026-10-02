import type { Song } from './types.js'

export type PartyGame = 'bingo' | 'roulette' | 'spotTrivia' | 'nameThatKaraoke'
export type Interlude = 'spot' | 'name'
export const PARTY_REQUEST = 'server/party/request'
export const PARTY_PUSH = 'party/push'
export const isPartyItem = (item?: { type?: string }) => item?.type === 'spot' || item?.type === 'name'
export const gameLabel = (type?: string) => type === 'name' ? 'Name That Karaoke' : type === 'spot' ? 'Spot Trivia' : 'Trivia'
export const rouletteBonus = (modifiers: number, rerolls: number) => 500 - modifiers * 100 - rerolls * 50
const BINGO_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
export interface BingoSquare {
  label: string
  value: number
  kind: 'song' | 'tag' | 'artist' | 'title' | 'triviaCorrect' | 'triviaPlay' | 'triviaWin' | 'battleStart' | 'battleWin' | 'roulette' | 'nameCorrect' | 'namePlay'
  match?: string | number
  done: boolean
}
export interface BingoCard { id: string, squares: BingoSquare[], payout: number, lines: number[][] }
export interface RouletteDraw { queueId: number, songId: number, originalSongId?: number, poolSongIds?: number[], filters: string[], rerolls: number, bonus: number, declined?: boolean }
export interface PartyRound {
  id: string
  queueId: number
  kind: Interlude
  question: string
  options: string[]
  participants: number[]
  answered: number[]
  winners: { userId: number, name: string, points: number }[]
  closed: boolean
  correctIdx?: number
  sentAt?: number
  endsAt?: number
  mediaId?: number
  mediaType?: 'mp4' | 'cdg'
}
export interface PartyState {
  enabled: Record<PartyGame, boolean>
  bingo: BingoCard | null
  roulette: RouletteDraw[]
  round: PartyRound | null
  answeredIdx: number | null
  resolvedQueueId?: number
}
export const emptyParty: PartyState = {
  enabled: { bingo: false, roulette: false, spotTrivia: false, nameThatKaraoke: false },
  bingo: null, roulette: [], round: null, answeredIdx: null,
}
export const matchingSongs = (songs: Song[], filters: string[]) => songs.filter(song => filters.every(tag => song.tags.includes(tag)))
export function bingoWin (squares: BingoSquare[]) {
  const lines = BINGO_LINES.filter(line => line.every(i => squares[i].done))
  return { lines, payout: lines.length ? Math.min(...lines.map(line => line.reduce((sum, i) => sum + squares[i].value, 0))) : 0 }
}

/** Die: 1–4 continue singing, 5–6 offer a game. If one game is unavailable,
 * use the eligible game; neither enabled means no interlude. */
export function chooseInterlude (spot: boolean, name: boolean, last: Interlude | null): Interlude | null {
  if (!spot && !name) return null
  if (!spot) return 'name'
  if (!name) return 'spot'
  return last === 'spot' ? 'name' : 'spot'
}
