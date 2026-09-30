import { describe, expect, it } from 'vitest'
import type { RootState } from 'store/store'
import type { LeaderboardEntry } from 'shared/types'
import { myStanding, nightPointsByUser, scoredLeaderboard } from './points'

const row = (userId: number, points: number): LeaderboardEntry => ({
  userId,
  name: `u${userId}`,
  avatarId: null,
  points,
  sings: 0,
  battleWins: 0,
  battlePlays: 0,
  triviaPoints: 0,
  triviaRounds: 0,
})

const state = (userId: number | null, board: LeaderboardEntry[]) =>
  ({ user: { userId }, points: { leaderboard: board } }) as unknown as RootState

describe('points selectors', () => {
  const board = [row(1, 1200), row(2, 900), row(3, 900), row(4, 0)]

  it('leaves people on 0 off the drawn leaderboard, in the same order', () => {
    expect(scoredLeaderboard(state(1, board)).map(e => e.userId)).toEqual([1, 2, 3])
    expect(scoredLeaderboard(state(1, [row(4, 0)]))).toEqual([])
  })

  it('maps every userId on the board to tonight\'s points', () => {
    expect(nightPointsByUser(state(1, board))).toEqual({ 1: 1200, 2: 900, 3: 900, 4: 0 })
  })

  it('ranks by place on the board, so a tie still counts on (as the design does)', () => {
    expect(myStanding(state(1, board))).toEqual({ points: 1200, rank: 1 })
    expect(myStanding(state(2, board))).toEqual({ points: 900, rank: 2 })
    expect(myStanding(state(3, board))).toEqual({ points: 900, rank: 3 })
    expect(myStanding(state(4, board))).toEqual({ points: 0, rank: 4 })
  })

  it('has no rank for someone not on the board', () => {
    expect(myStanding(state(9, board))).toEqual({ points: 0, rank: null })
    expect(myStanding(state(null, []))).toEqual({ points: 0, rank: null })
  })
})
