import { createAction, createReducer } from '@reduxjs/toolkit'
import { Song } from 'shared/types'
import { LIBRARY_PUSH } from 'shared/actionTypes'

const libraryPush = createAction<{
  songs: SongsState
}>(LIBRARY_PUSH)

// ------------------------------------
// Reducer
// ------------------------------------
export interface SongsState {
  result: number[]
  entities: Record<number, Song>
}

const initialState: SongsState = {
  result: [],
  entities: {},
}

const songsReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(libraryPush, (_, { payload }) => ({
      result: payload.songs.result,
      entities: payload.songs.entities,
    }))
})

export default songsReducer
