import { createAction, createReducer } from '@reduxjs/toolkit'
import type { LeaderboardEntry } from 'shared/types'
import { LOGOUT, POINTS_PUSH } from 'shared/actionTypes'

const pointsPush = createAction<LeaderboardEntry[]>(POINTS_PUSH)
const logout = createAction(LOGOUT)

/** The room's leaderboard for the night, best first, exactly as the server
 *  last sent it. Nothing here is counted locally: every phone shows the same
 *  board because none of them keeps its own. */
export interface PointsState {
  leaderboard: LeaderboardEntry[]
}

const initialState: PointsState = {
  leaderboard: [],
}

const pointsReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(pointsPush, (_state, { payload }) => ({ leaderboard: payload }))
    .addCase(logout, () => initialState)
})

export default pointsReducer
