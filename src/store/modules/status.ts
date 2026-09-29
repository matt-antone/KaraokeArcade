import { createAction, createReducer } from '@reduxjs/toolkit'
import { type PlayerVisualizerState } from 'routes/Player/modules/playerVisualizer'
import {
  PLAYER_REQ_NEXT,
  PLAYER_REQ_OPTIONS,
  PLAYER_REQ_PLAY,
  PLAYER_REQ_PAUSE,
  PLAYER_REQ_REPLAY,
  PLAYER_REQ_VOLUME,
  PLAYER_STATUS,
  PLAYER_LEAVE,
} from 'shared/actionTypes'
import { MediaType, PlaybackOptions, type PlayerLeadIn } from 'shared/types'

// ------------------------------------
// Actions
// ------------------------------------
export const requestPlay = createAction(PLAYER_REQ_PLAY)
export const requestPause = createAction(PLAYER_REQ_PAUSE)
export const requestPlayNext = createAction(PLAYER_REQ_NEXT)
const playerStatus = createAction<object>(PLAYER_STATUS)
const playerLeave = createAction(PLAYER_LEAVE)

export const requestReplay = createAction(PLAYER_REQ_REPLAY, (queueId: number) => ({
  payload: { queueId },
}))

export const requestVolume = createAction(PLAYER_REQ_VOLUME, (vol: number) => ({
  payload: vol,
  meta: {
    throttle: {
      wait: 200,
      leading: false,
    },
  },
}))

export const requestOptions = createAction(PLAYER_REQ_OPTIONS, (opts: PlaybackOptions) => ({
  payload: opts,
  meta: {
    throttle: {
      wait: 200,
      leading: true,
    },
  },
}))

// ------------------------------------
// Reducer
// ------------------------------------
/** The TV's status as the phones hold it. The lead-in fields arrive while a
 *  song counts in (12e0) and are absent otherwise. */
export interface StatusState extends PlayerLeadIn {
  cdgAlpha: number
  cdgSize: number
  errorMessage: string
  historyJSON: string // queueIds in JSON array
  isAtQueueEnd: boolean
  isErrored: boolean
  isPlayerPresent: boolean
  isPlaying: boolean
  isVideoKeyingEnabled: boolean
  isWebGLSupported: boolean
  mediaType: MediaType | null
  mp4Alpha: number
  nextUserId: number | null
  position: number
  queueId: number
  /** When the server sent this status, by its clock (for lib/serverNow). */
  sentAt?: number
  visualizer: PlayerVisualizerState | Record<string, never>
  volume: number
}

const initialState: StatusState = {
  cdgAlpha: 0,
  cdgSize: 0.8,
  errorMessage: '',
  historyJSON: '[]', // queueIds in JSON array
  isAtQueueEnd: false,
  isErrored: false,
  isPlayerPresent: false,
  isPlaying: false,
  isVideoKeyingEnabled: false,
  isWebGLSupported: false,
  mediaType: null,
  mp4Alpha: 1,
  nextUserId: null,
  position: 0,
  queueId: -1,
  visualizer: {},
  volume: 1,
}

const statusReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(playerLeave, (state) => {
      state.isPlayerPresent = false
    })
    .addCase(playerStatus, (state, { payload }) => ({
      ...state,
      ...payload,
      // replaced, never merged: a lead-in that ended arrives as absent keys
      // (JSON drops undefined), which a merge would read as still running
      leadInEndsAt: (payload as PlayerLeadIn).leadInEndsAt,
      leadInQueueId: (payload as PlayerLeadIn).leadInQueueId,
      isPlayerPresent: true,
    }))
})

export default statusReducer
