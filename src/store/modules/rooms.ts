import { createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import type { AppThunk, RootState } from 'store/store'
import type { IRoomPrefs, Room, RoomStatus } from 'shared/types'
import {
  ROOMS_RECEIVE,
  ROOMS_REQUEST,
  ROOM_EDITOR_OPEN,
  ROOM_EDITOR_CLOSE,
  ROOM_FILTER_STATUS,
  ROOM_UPDATE,
  ROOM_CREATE,
  ROOM_REMOVE,
  ROOM_SET_STATUS,
  ROOM_PREFS_PUSH,
  ROOM_STATUS_PUSH,
  ROOM_PREFS_PUSH_REQUEST,
  TRIVIA_SCORES_RESET,
  LOGOUT,
} from 'shared/actionTypes'

import HttpApi from 'lib/HttpApi'
const api = new HttpApi('rooms')

// ------------------------------------
// Actions
// ------------------------------------
const receiveRooms = createAction<object>(ROOMS_RECEIVE)

export const fetchRooms = createAsyncThunk(
  ROOMS_REQUEST,
  async () => await api.get(''),
)

export const fetchCurrentRoom = createAsyncThunk<object, void, { state: RootState }>(
  ROOMS_REQUEST,
  async (_, thunkAPI) => {
    const roomId = thunkAPI.getState().user.roomId

    if (typeof roomId !== 'number') {
      return Promise.reject('Please sign into a room')
    }

    return await api.get(`/${roomId}`)
  },
)

export const createRoom = createAsyncThunk(
  ROOM_CREATE,
  async (data: object, thunkAPI) => {
    const response = await api.post('', {
      body: data,
    })

    thunkAPI.dispatch(receiveRooms(response))
    thunkAPI.dispatch(closeRoomEditor())
  },
)

export const updateRoom = createAsyncThunk(
  ROOM_UPDATE,
  async ({
    roomId,
    data,
  }: {
    roomId: number
    data: object
  }, thunkAPI) => {
    const response = await api.put(`/${roomId}`, {
      body: data,
    })

    thunkAPI.dispatch(receiveRooms(response))
    thunkAPI.dispatch(closeRoomEditor())
  },
)

export const removeRoom = createAsyncThunk(
  ROOM_REMOVE,
  async (roomId: number, thunkAPI) => {
    const response = await api.delete(`/${roomId}`)

    thunkAPI.dispatch(receiveRooms(response))
    thunkAPI.dispatch(closeRoomEditor())
  },
)

export const openRoomEditor = createAction(ROOM_EDITOR_OPEN)
export const closeRoomEditor = createAction(ROOM_EDITOR_CLOSE)
export const filterByStatus = createAction<boolean | string>(ROOM_FILTER_STATUS)
const roomPrefsPush = createAction<{ roomId: number, prefs: IRoomPrefs }>(ROOM_PREFS_PUSH)
const roomStatusPush = createAction<{ roomId: number, status: RoomStatus }>(ROOM_STATUS_PUSH)

export function requestPrefsPush (roomId: number, prefs: IRoomPrefs): AppThunk {
  return (dispatch) => {
    dispatch({
      type: ROOM_PREFS_PUSH_REQUEST,
      payload: {
        roomId,
        prefs,
      },
      meta: {
        throttle: {
          wait: 200,
          leading: true,
        },
      },
    })
  }
}

/** Move a room's transport. The server does the work each state implies —
 *  stopping the player, and on stop emptying the queue and the scoreboard —
 *  and answers with the updated room list, so this reduces like any other
 *  room write. */
export const setRoomStatus = createAsyncThunk(
  ROOM_SET_STATUS,
  async ({ roomId, status }: { roomId: number, status: RoomStatus }, thunkAPI) => {
    const response = await api.post(`/${roomId}/status`, {
      body: { status },
    })

    thunkAPI.dispatch(receiveRooms(response))
  },
)

/** Clear a room's trivia scoreboard. Carries the roomId for the same reason
 *  the room reset above does: between nights the admin is not necessarily
 *  signed in to the room being changed. */
export const requestScoresReset = createAction(TRIVIA_SCORES_RESET, (roomId: number) => ({
  payload: { roomId },
}))

// ------------------------------------
// Reducer
// ------------------------------------
export interface RoomsState {
  result: number[]
  entities: Record<number, Room>
  filterStatus: boolean | string
  isEditorOpen: boolean
  /**
   * The transport of the room this device is in, as the server last told it.
   *
   * Kept beside `entities` rather than in it because it arrives without the
   * rest of a room — a singer's phone never fetches the room list, and faking
   * an entity out of a roomId and a status would put a nameless half-room in
   * the list the Settings screen draws from.
   *
   * null means nobody has said yet, which is not the same as stopped: a client
   * that has not heard is left able to queue rather than being shown a dead
   * library on missing data.
   */
  myRoomStatus: RoomStatus | null
}

const initialState: RoomsState = {
  result: [],
  entities: {},
  // Show every room by default. This list is where the transport lives, so a
  // filter that hides rooms by state hides the row the moment you act on it —
  // press stop and the room you were holding vanishes, which reads as having
  // deleted it. The filter stays for looking things up; it is not the default
  // any more.
  filterStatus: false,
  isEditorOpen: false,
  myRoomStatus: null,
}

const roomsReducer = createReducer(initialState, (builder) => {
  builder
    // handles both fetchRooms and fetchCurrentRoom
    .addCase(fetchRooms.fulfilled, (state, { payload }) => ({
      ...state,
      ...payload,
    }))
    .addCase(receiveRooms, (state, { payload }) => ({
      ...state,
      ...payload,
    }))
    .addCase(openRoomEditor, (state) => {
      state.isEditorOpen = true
    })
    .addCase(closeRoomEditor, (state) => {
      state.isEditorOpen = false
    })
    .addCase(filterByStatus, (state, { payload }) => {
      state.filterStatus = payload
    })
    .addCase(roomPrefsPush, (state, { payload }) => {
      const roomId = payload.roomId

      if (state.entities[roomId]) {
        state.entities[roomId].prefs = payload.prefs
      }
    })
    .addCase(roomStatusPush, (state, { payload }) => {
      state.myRoomStatus = payload.status

      // the rooms list, when this device happens to have one, is looking at the
      // same fact and would otherwise keep showing the old transport
      if (state.entities[payload.roomId]) {
        state.entities[payload.roomId].status = payload.status
      }
    })
    .addCase(LOGOUT, () => ({
      ...initialState,
    }))
})

export default roomsReducer
