import { createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import { persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import socket from 'lib/socket'
import { navigate } from 'lib/navigate'
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'
import type { RootState } from 'store/store'
import { SongHistoryItem } from 'shared/types'
import HttpApi from 'lib/HttpApi'
import * as Persistor from 'store/Persistor'
import { fetchPrefs } from './prefs'
import {
  ACCOUNT_RECEIVE,
  ACCOUNT_REQUEST,
  ACCOUNT_SET_ROOM,
  ACCOUNT_CREATE,
  ACCOUNT_UPDATE,
  LOGIN,
  LOGOUT,
  SOCKET_AUTH_ERROR,
  SOCKET_REQUEST_CONNECT,
} from 'shared/actionTypes'

const api = new HttpApi('')
const basename = new URL(document.baseURI).pathname

const receiveAccount = createAction<object>(ACCOUNT_RECEIVE)

// login and createAccount both land here
const completeSignIn = async (user: object, dispatch: ThunkDispatch<RootState, unknown, UnknownAction>) => {
  // signing in can cause additional reducers to be injected and
  // trigger rehydration with stale data, so purge here first
  Persistor.get().purge()

  dispatch(receiveAccount(user))
  dispatch(fetchPrefs())
  dispatch(connectSocket())
  socket.open()

  // redirect in query string?
  const redirect = new URLSearchParams(window.location.search).get('redirect')
  if (!redirect) return

  navigate(basename.replace(/\/$/, '') + redirect)
}

// ------------------------------------
// Login
// ------------------------------------
export const login = createAsyncThunk<void, object, { state: RootState }>(
  LOGIN,
  async (creds: object, thunkAPI) => {
    // calls api endpoint that should set an httpOnly cookie with
    // our JWT, then establish the sockiet.io connection
    const user = await api.post('login', {
      body: creds,
    })

    await completeSignIn(user, thunkAPI.dispatch)
  },
)

// ------------------------------------
// Change room
// ------------------------------------

/**
 * Move to another room without signing out.
 *
 * The room lives in the JWT, so the server re-issues the cookie and hands back
 * the same account payload a sign-in does. The socket is then bounced: it read
 * the old cookie at its handshake and is still joined to the old room's
 * channel, and on reconnecting the server pushes this room's queue, trivia
 * round and battle beat the way it does for anyone arriving.
 *
 * No Persistor purge, unlike completeSignIn. Nothing being rehydrated belongs
 * to the old room — the account is the same account — and purging here would
 * throw away the sung history the Account view is drawing behind this.
 */
export const setRoom = createAsyncThunk<void, { roomId: number, roomPassword?: string }, { state: RootState }>(
  ACCOUNT_SET_ROOM,
  async ({ roomId, roomPassword }, thunkAPI) => {
    const user = await api.post('user/room', {
      body: { roomId, roomPassword },
    })

    thunkAPI.dispatch(receiveAccount(user))

    socket.close()
    socket.open()
  },
)

// ------------------------------------
// Logout
// ------------------------------------
const logout = createAction(LOGOUT)

export const requestLogout = createAsyncThunk(
  LOGOUT,
  async (_, thunkAPI) => {
    try {
      // server response should clear our cookie
      await api.get('logout')
    } catch {
      // ignore errors
    }

    thunkAPI.dispatch(logout())
    Persistor.get().purge()
    socket.close()
  },
)

// ------------------------------------
// Create account
// ------------------------------------
export const createAccount = createAsyncThunk<void, FormData, { state: RootState }>(
  ACCOUNT_CREATE,
  async (data: FormData, thunkAPI) => {
    const isFirstRun = thunkAPI.getState().prefs.isFirstRun

    const user = await api.post(isFirstRun ? 'setup' : 'user', {
      body: data,
    })

    await completeSignIn(user, thunkAPI.dispatch)
  },
)

// ------------------------------------
// Update account
// ------------------------------------
export const updateAccount = createAsyncThunk<void, FormData, { state: RootState }>(
  ACCOUNT_UPDATE,
  async (data: FormData, thunkAPI) => {
    const { userId } = thunkAPI.getState().user

    const user = await api.put(`user/${userId}`, {
      body: data,
    })

    thunkAPI.dispatch(receiveAccount(user))
    alert('Account updated successfully.')
  },
)

// ------------------------------------
// Request account (does not refresh JWT)
// ------------------------------------
export const fetchAccount = createAsyncThunk(
  ACCOUNT_REQUEST,
  async (_, thunkAPI) => {
    try {
      const user = await api.get('user')
      thunkAPI.dispatch(receiveAccount(user))
    } catch {
      // ignore errors
    }
  },
)

// ------------------------------------
// Socket actions
// ------------------------------------
const requestSocketConnect = createAction<object>(SOCKET_REQUEST_CONNECT)

export const connectSocket = createAsyncThunk<void, void, { state: RootState }>(
  'user/SOCKET_CONNECT',
  async (_, { dispatch, getState }) => {
    const versions = {
      library: getState().library.version,
      stars: getState().starCounts.version,
    }

    dispatch(requestSocketConnect(versions))
    socket.io.opts.query = versions
  },
)

// ------------------------------------
// Reducer
// ------------------------------------
export interface UserState {
  userId: number | null
  username: string | null
  name: string | null
  roomId: number | null
  isAdmin: boolean
  isGuest: boolean
  dateCreated: number
  dateUpdated: number
  history: SongHistoryItem[]
}

const initialState: UserState = {
  userId: null,
  username: null,
  name: null,
  roomId: null,
  isAdmin: false,
  isGuest: false,
  dateCreated: 0,
  dateUpdated: 0,
  history: [],
}

const userReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(receiveAccount, (state, { payload }) => ({
      ...state,
      ...payload,
    }))
    .addCase(LOGOUT, () => ({
      ...initialState,
    }))
    .addCase(SOCKET_AUTH_ERROR, () => ({
      ...initialState,
    }))
})

export default persistReducer({
  key: 'user',
  storage,
}, userReducer)
