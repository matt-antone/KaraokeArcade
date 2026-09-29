import { createAction, createReducer } from '@reduxjs/toolkit'
import type { AppThunk } from 'store/store'
import { CANCEL } from 'redux-throttle'
import getWebGLSupport from 'lib/getWebGLSupport'
import {
  PLAYER_CMD_HISTORY_RESET,
  PLAYER_CMD_NEXT,
  PLAYER_CMD_OPTIONS,
  PLAYER_CMD_PAUSE,
  PLAYER_CMD_PLAY,
  PLAYER_CMD_REPLAY,
  PLAYER_CMD_VOLUME,
  PLAYER_EMIT_LEAVE,
  PLAYER_EMIT_STATUS,
  PLAYER_ERROR,
  PLAYER_LOAD,
  PLAYER_PLAY,
  PLAYER_UPDATE,
  REDUX_SLICE_INJECT_NOOP,
} from 'shared/actionTypes'
import type { PlayerLeadIn } from 'shared/types'

// internal use
const playerUpdate = createAction<object>(PLAYER_UPDATE)

// triggered by media events
export const playerError = createAction<string>(PLAYER_ERROR)
export const playerLoad = createAction(PLAYER_LOAD)
export const playerPlay = createAction(PLAYER_PLAY)
const playerCmdNext = createAction(PLAYER_CMD_NEXT)

// triggered by clients
const playerCmdPause = createAction(PLAYER_CMD_PAUSE)
const playerCmdPlay = createAction(PLAYER_CMD_PLAY)
const playerCmdReplay = createAction<{ queueId: number }>(PLAYER_CMD_REPLAY)
const playerCmdHistoryReset = createAction(PLAYER_CMD_HISTORY_RESET)
const playerCmdVolume = createAction<number>(PLAYER_CMD_VOLUME)
const playerCmdOptions = createAction<{
  cdgAlpha: number
  cdgSize: number
  mp4Alpha: number
}>(PLAYER_CMD_OPTIONS)

// ------------------------------------
// Actions for emitting to room
// ------------------------------------
export function playerStatus (status: Partial<PlayerState> = {}, deferEmit = false): AppThunk {
  return (dispatch, getState) => {
    const { player, playerVisualizer } = getState()

    // update "internal" state (player slice); status is partial
    dispatch(playerUpdate(status))

    // emit full updated status (excluding "private" properties)
    const emitStatus = Object.fromEntries(
      Object.entries({
        ...player, // previous complete state
        ...status, // current partial state
      }).filter(([key]) => !key.startsWith('_')),
    )

    dispatch({
      type: PLAYER_EMIT_STATUS,
      payload: {
        ...emitStatus,
        visualizer: playerVisualizer,
      },
      meta: {
        throttle: {
          wait: 1000,
          leading: !deferEmit,
        },
      },
    })
  }
}

// cancel any throttled/queued status emits
function playerStatusCancel () {
  return {
    type: CANCEL,
    payload: {
      type: PLAYER_EMIT_STATUS,
    },
  }
}

export function playerLeave (): AppThunk {
  return (dispatch) => {
    dispatch(playerStatusCancel())
    dispatch({
      type: PLAYER_EMIT_LEAVE,
    })
  }
}

// ------------------------------------
// Reducer
// ------------------------------------
/** The lead-in fields ride along only while a trivia row counts in (D8), so
 *  the phones can draw 12e0; every other status carries them as absent. */
export interface PlayerState extends PlayerLeadIn {
  cdgAlpha: number
  cdgSize: number
  duration: number
  errorMessage: string
  historyJSON: string
  isAtQueueEnd: boolean
  isErrored: boolean
  isPlaying: boolean
  isVideoKeyingEnabled: boolean
  isWebGLSupported: boolean
  mediaType: string | null
  mp4Alpha: number
  nextUserId: number | null
  position: number
  queueId: number
  rgTrackGain: number | null
  rgTrackPeak: number | null
  volume: number
  _isFetching: boolean
  _isPlayingNext: boolean
  _isReplayingQueueId: number | null
  _lastHistoryResetTime: number
  _lastReplayTime: number
  _lastSkipTime: number
}

const initialState: PlayerState = {
  cdgAlpha: 0.5,
  cdgSize: 0.65,
  duration: 0,
  errorMessage: '',
  historyJSON: '[]', // queueIds (JSON string is hack to pass selector equality check on clients)
  isAtQueueEnd: false,
  isErrored: false,
  isPlaying: false,
  isVideoKeyingEnabled: false,
  isWebGLSupported: getWebGLSupport(),
  mediaType: null,
  mp4Alpha: 0.5,
  nextUserId: null,
  position: 0,
  queueId: -1,
  rgTrackGain: null,
  rgTrackPeak: null,
  volume: 1,
  // "private" internal state that shouldn't be emitted
  _isFetching: false,
  _isPlayingNext: false,
  _isReplayingQueueId: null,
  _lastHistoryResetTime: 0,
  _lastReplayTime: 0,
  _lastSkipTime: 0,
}

const playerReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(playerCmdHistoryReset, (state) => {
      // the controller does the emptying, so the room hears about it too
      state._lastHistoryResetTime = Date.now()
    })
    .addCase(playerCmdNext, (state) => {
      state._isPlayingNext = true
      state._lastSkipTime = Date.now()
    })
    .addCase(playerCmdOptions, (state, { payload }) => ({
      ...state,
      cdgAlpha: typeof payload.cdgAlpha === 'number' ? payload.cdgAlpha : state.cdgAlpha,
      cdgSize: typeof payload.cdgSize === 'number' ? payload.cdgSize : state.cdgSize,
      mp4Alpha: typeof payload.mp4Alpha === 'number' ? payload.mp4Alpha : state.mp4Alpha,
    }))
    .addCase(playerCmdPause, (state) => {
      state.isPlaying = false
    })
    .addCase(playerCmdPlay, (state) => {
      state.isPlaying = true
    })
    .addCase(playerCmdReplay, (state, { payload }) => {
      state._isReplayingQueueId = payload.queueId
      state._lastReplayTime = Date.now()
    })
    .addCase(playerCmdVolume, (state, { payload }) => {
      state.volume = payload
    })
    .addCase(playerError, (state, { payload }) => ({
      ...state,
      errorMessage: payload,
      isErrored: true,
      isPlaying: false,
      _isFetching: false,
    }))
    .addCase(playerLoad, state => ({
      ...state,
      errorMessage: '',
      isErrored: false,
      _isFetching: true,
    }))
    .addCase(playerPlay, (state) => {
      state._isFetching = false
    })
    .addCase(playerUpdate, (state, { payload }) => ({
      ...state,
      ...payload,
    }))
})

export default playerReducer

declare module 'store/reducers' {
  export interface LazyLoadedSlices {
    player: typeof initialState
  }
}

export const sliceInjectNoOp = createAction(REDUX_SLICE_INJECT_NOOP)
