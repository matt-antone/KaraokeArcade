import { createAction, createReducer } from '@reduxjs/toolkit'
import {
  QUEUE_ADD,
  QUEUE_MOVE,
  QUEUE_PAUSE,
  QUEUE_PUSH,
  QUEUE_REMOVE,
  QUEUE_SET_KEY,
  LOGOUT,
} from 'shared/actionTypes'
import type { QueueItem, OptimisticQueueItem } from 'shared/types'

// ------------------------------------
// Actions
// ------------------------------------
const logout = createAction(LOGOUT)
export const moveItem = createAction<{ queueId: number, prevQueueId: number }>(QUEUE_MOVE)
export const removeItem = createAction<{ queueId: number | number[] }>(QUEUE_REMOVE)
export const setPaused = createAction<{ isPaused: boolean, userId?: number }>(QUEUE_PAUSE)
export const setKeyChange = createAction<{ keyChange: number, queueId: number }>(QUEUE_SET_KEY)
export const queuePush = createAction<QueueState>(QUEUE_PUSH)

export const queueSong = createAction(QUEUE_ADD, (songId: number) => ({
  payload: { songId },
  meta: { isOptimistic: true },
}))

// ------------------------------------
// Reducer
// ------------------------------------
export interface QueueState {
  isLoading: boolean
  result: number[] // queueIds
  entities: Record<number, QueueItem | OptimisticQueueItem>
  pausedUserIds: number[] // users sitting out; their upcoming songs leave the rotation
}

const initialState: QueueState = {
  isLoading: true,
  result: [],
  entities: {},
  pausedUserIds: [],
}

const queueReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(queueSong, (state, { payload }) => {
      // optimistic
      const nextQueueId = state.result.length ? (state.result[state.result.length - 1] as number) + 1 : 1

      state.result.push(nextQueueId)
      state.entities[nextQueueId] = {
        ...payload,
        queueId: nextQueueId,
        prevQueueId: nextQueueId - 1 || null,
        isOptimistic: true,
      }
    })
    .addCase(queuePush, (state, { payload }) => ({
      isLoading: false,
      result: payload.result,
      entities: payload.entities,
      pausedUserIds: payload.pausedUserIds,
    }))
    .addCase(logout, (state) => {
      state.result = []
      state.entities = {}
      state.pausedUserIds = []
    })
})

export default queueReducer
