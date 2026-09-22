// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { configureStore, type Middleware, type UnknownAction } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { ensureState } from 'redux-optimistic-ui'
import type { Socket } from 'socket.io-client'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
// reducers -> user -> AppRouter -> App -> store/store -> reducers is a cycle
// the app only survives because its entry enters at the store; importing the
// reducers first hands configureStore an undefined reducer. Enter where the app
// does. (The app's own store is not used here — it has the real socket.)
import 'store/store'
import rootReducer from 'store/reducers'
import createSocketMiddleware from 'store/socketMiddleware'
import { queuePush } from '../../modules/queue'
import { SNAP_AT, SWIPE_ACTION_WIDTH } from 'components/SwipeRow/constants'
import { PLAYER_REQ_NEXT, PLAYER_REQ_REPLAY, QUEUE_REMOVE, QUEUE_SET_KEY, STAR_SONG, UNSTAR_SONG } from 'shared/actionTypes'
import { KEY_CHANGE_MAX } from 'shared/types'
import QueueItem from './QueueItem'

/**
 * QueueItem.test.tsx mocks the dispatch away, so it can only prove a key fires
 * *a* handler. These render against the app's real reducers and the real socket
 * middleware (with a stub socket in place of the network), so what is asserted
 * is where each action ends up.
 *
 * Two different endings, and the difference is the point:
 *  - starring is optimistic and lands in local state immediately
 *  - removing, replaying and skipping are requests: the middleware emits them
 *    and the server's push is what changes state. Nothing local to assert, so
 *    these assert the emit, plus the push that completes the round trip.
 */

// vitest globals are off, so RTL's own afterEach hook never registers
afterEach(cleanup)

const USER_ID = 3
const SONG_ID = 2

const makeStore = () => {
  const emitted: UnknownAction[] = []
  let serverSend: (action: UnknownAction) => void = () => {}

  // the middleware's whole contract with socket.io: it listens for pushes and
  // emits requests. Both ends are captured here instead of dialed out.
  const socket = {
    on: (event: string, handler: (action: UnknownAction) => void) => {
      if (event === 'action') serverSend = handler
    },
    emit: (event: string, action: UnknownAction) => emitted.push(action),
  } as unknown as Socket

  const record: Middleware = () => next => (action) => {
    // before the socket middleware, so a request is recorded as dispatched
    // even though it never reaches a reducer that cares
    dispatched.push(action as UnknownAction)
    return next(action)
  }
  const dispatched: UnknownAction[] = []

  const store = configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware => getDefaultMiddleware()
      .concat(record, createSocketMiddleware(socket, 'server/')),
  })

  const fromServer = (action: UnknownAction) => act(() => {
    serverSend(action)
  })

  return { store, emitted, dispatched, fromServer }
}

/** what the server pushes: `queueIds`, all sung by USER_ID */
const serverQueue = (queueIds: number[]) => queuePush({
  isLoading: false,
  result: queueIds,
  entities: Object.fromEntries(queueIds.map(queueId => [queueId, { queueId, songId: SONG_ID, userId: USER_ID }])),
  pausedUserIds: [],
} as unknown as Parameters<typeof queuePush>[0])

const base = {
  artist: 'Cheap Trick',
  errorMessage: '',
  isCurrent: false,
  isErrored: false,
  isMovable: true,
  isOwner: false,
  isPaused: false,
  isPlayed: false,
  isPlaying: true,
  isRemovable: true,
  isReplayable: true,
  isSkippable: true,
  isStarred: false,
  isTunable: false,
  isUpcoming: false,
  keyChange: 0,
  pctPlayed: 0,
  queueId: 1,
  songId: SONG_ID,
  starCount: 0,
  title: 'Surrender',
  userDateUpdated: 0,
  userDisplayName: 'Robin',
  userAvatarId: 'p3',
  userId: USER_ID,
  onMoveClick: () => {},
}

const renderRow = (props: Partial<typeof base> = {}) => {
  const ctx = makeStore()
  const { container } = render(
    <Provider store={ctx.store}><QueueItem {...base} {...props} /></Provider>,
  )

  return { ...ctx, container, slider: container.querySelector('.slider') as HTMLElement }
}

/** a real swipe, far enough past SNAP_AT to leave the row open */
const swipeOpen = (slider: HTMLElement) => {
  fireEvent.pointerDown(slider, { clientX: 100, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(slider, { clientX: 100 - (SWIPE_ACTION_WIDTH * SNAP_AT) - 20, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(slider)
}

const typesOf = (actions: UnknownAction[]) => actions.map(a => a.type)

describe('QueueItem against the real store', () => {
  it('sends the removal on Remove, and the queue empties on the push that answers it', () => {
    const { store, emitted, slider, fromServer } = renderRow()
    fromServer(serverQueue([1, 2]))

    swipeOpen(slider)
    fireEvent.click(screen.getByLabelText('Remove'))

    expect(emitted).toEqual([expect.objectContaining({ type: QUEUE_REMOVE, payload: { queueId: 1 } })])
    // removal is the server's to make: nothing about the queue has changed yet
    expect(ensureState(store.getState().queue).result).toEqual([1, 2])

    fromServer(serverQueue([2]))
    expect(ensureState(store.getState().queue).result).toEqual([2])
  })

  it('stars the song in local state as soon as the star is pressed', async () => {
    const { store, emitted } = renderRow()

    await act(async () => {
      fireEvent.click(screen.getByLabelText('star'))
    })

    // optimistic: the reducer has already run, ahead of any server answer
    expect(ensureState(store.getState().userStars).starredSongs).toEqual([SONG_ID])
    expect(typesOf(emitted)).toEqual([STAR_SONG])
  })

  it('unstars from the same key, which means the thunk read the real store', async () => {
    const { store, emitted } = renderRow({ isStarred: true })

    await act(async () => {
      fireEvent.click(screen.getByLabelText('unstar'))
    })
    // nothing starred yet, so a store-blind toggle would star it here
    expect(ensureState(store.getState().userStars).starredSongs).toEqual([SONG_ID])

    await act(async () => {
      fireEvent.click(screen.getByLabelText('unstar'))
    })
    expect(ensureState(store.getState().userStars).starredSongs).toEqual([])
    expect(typesOf(emitted)).toEqual([STAR_SONG, UNSTAR_SONG])
  })

  it('sends the transport request behind Replay and Skip', () => {
    const { emitted, slider } = renderRow()

    swipeOpen(slider)
    fireEvent.click(screen.getByLabelText('Replay'))
    fireEvent.click(screen.getByLabelText('Skip'))

    expect(emitted).toEqual([
      expect.objectContaining({ type: PLAYER_REQ_REPLAY, payload: { queueId: 1 } }),
      expect.objectContaining({ type: PLAYER_REQ_NEXT }),
    ])
  })

  it('gives a played row nothing that can reach the server but the star', async () => {
    // every permission still granted — being played is what takes them away
    const { container, emitted, dispatched, slider } = renderRow({ isPlayed: true })

    swipeOpen(slider)
    for (const button of Array.from(container.querySelectorAll('button'))) {
      await act(async () => {
        fireEvent.click(button)
      })
    }

    expect(typesOf(emitted)).toEqual([STAR_SONG])
    expect(typesOf(dispatched).filter(t => t.startsWith('server/'))).toEqual([STAR_SONG])
  })
})

/**
 * The gear is the Me tab's way into per-song settings, and key is the only one
 * so far. Like Remove, setting a key is a request: the server's push is what
 * changes state, so what these assert is the emit.
 */
describe('song settings', () => {
  const open = () => {
    const ctx = renderRow({ isTunable: true, isUpcoming: true, isPlaying: false })
    swipeOpen(ctx.slider)
    fireEvent.click(screen.getByLabelText('Settings'))
    return ctx
  }

  it('has no gear on a row the singer cannot change', () => {
    const { slider } = renderRow()
    swipeOpen(slider)
    expect(screen.queryByLabelText('Settings')).toBeNull()
  })

  it('opens on the gear showing the song in its own key', () => {
    open()
    expect(screen.getByText('Song Settings')).toBeTruthy()
    expect(screen.getByText('0')).toBeTruthy()
  })

  it('sends one semitone per press, in the direction pressed', () => {
    const { emitted } = open()

    fireEvent.click(screen.getByLabelText('Raise the key one semitone'))
    fireEvent.click(screen.getByLabelText('Lower the key one semitone'))

    expect(emitted).toEqual([
      expect.objectContaining({ type: QUEUE_SET_KEY, payload: { keyChange: 1, queueId: 1 } }),
      expect.objectContaining({ type: QUEUE_SET_KEY, payload: { keyChange: 0, queueId: 1 } }),
    ])
  })

  it('compounds presses that land before the server answers', () => {
    const { emitted } = open()

    // no push between them: each press must build on the last, not on the
    // row's stale keyChange. Reading the prop here moved the song one semitone
    // however many times you tapped.
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByLabelText('Raise the key one semitone'))
    }

    expect(emitted.map(a => (a.payload as { keyChange: number }).keyChange)).toEqual([1, 2, 3])
    expect(screen.getByText('+3')).toBeTruthy()
  })

  it('cannot step past the supported range', () => {
    const ctx = renderRow({ isTunable: true, isUpcoming: true, isPlaying: false, keyChange: KEY_CHANGE_MAX })
    swipeOpen(ctx.slider)
    fireEvent.click(screen.getByLabelText('Settings'))

    fireEvent.click(screen.getByLabelText('Raise the key one semitone'))
    expect(ctx.emitted).toEqual([])
  })

  it('keeps reset in place but inert while the song is in its own key', () => {
    const { emitted } = open()

    fireEvent.click(screen.getByText('Reset to original key'))
    expect(emitted).toEqual([])
  })

  it('sends 0 on reset once the song has left its own key', () => {
    const ctx = renderRow({ isTunable: true, isUpcoming: true, isPlaying: false, keyChange: -4 })
    swipeOpen(ctx.slider)
    fireEvent.click(screen.getByLabelText('Settings'))
    fireEvent.click(screen.getByText('Reset to original key'))

    expect(ctx.emitted).toEqual([
      expect.objectContaining({ type: QUEUE_SET_KEY, payload: { keyChange: 0, queueId: 1 } }),
    ])
  })

  it('reads the key on the row face without opening anything', () => {
    renderRow({ keyChange: 3 })
    expect(screen.getByText('key +3')).toBeTruthy()
  })
})
