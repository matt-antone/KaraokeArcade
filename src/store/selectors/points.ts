import type { RootState } from 'store/store'
import { createSelector } from '@reduxjs/toolkit'

const getLeaderboard = (state: RootState) => state.points.leaderboard
const getUserId = (state: RootState) => state.user.userId

/** Tonight's points by userId, for anything that draws a person's total beside
 *  their name (HUD, queue rows, 13a rows, 08, 08b, 08c). */
export const nightPointsByUser = createSelector(
  [getLeaderboard],
  (board): Record<number, number> => Object.fromEntries(board.map(e => [e.userId, e.points])),
)

/** Where this device's user stands tonight: their place in the board's order
 *  (the design's `ord(findIndex + 1)`), so a tie still gets its own row
 *  number; null when not on the board. */
export const myStanding = createSelector(
  [getLeaderboard, getUserId],
  (board, userId): { points: number, rank: number | null } => {
    const i = board.findIndex(e => e.userId === userId)

    return i < 0 ? { points: 0, rank: null } : { points: board[i].points, rank: i + 1 }
  },
)
