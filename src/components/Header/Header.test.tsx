// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { configureStore, type UnknownAction } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter, useLocation } from 'react-router'
import { ensureState } from 'redux-optimistic-ui'
import type { Socket } from 'socket.io-client'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
// reducers -> user -> AppRouter -> App -> store/store -> reducers is a cycle;
// the app only survives because its entry enters at the store (see
// QueueItem.store.test.tsx). Enter where the app does.
import 'store/store'
import rootReducer from 'store/reducers'
import createSocketMiddleware from 'store/socketMiddleware'
import { queuePush } from 'routes/Queue/modules/queue'
import { ACCOUNT_RECEIVE, LIBRARY_PUSH, PLAYER_STATUS, QUEUE_PAUSE } from 'shared/actionTypes'
import Header from './Header'

/**
 * The singer's pause lives in the header on every screen, and it is the one
 * control that takes them out of the rotation. Rendered here against the app's
 * real reducers so both halves are exercised: the request the button sends, and
 * the pushed state the header reads back.
 *
 * Pausing is the server's decision to record — no reducer touches
 * pausedUserIds except on a push — so the outbound half asserts the emit.
 */

// vitest globals are off, so RTL's own afterEach hook never registers
afterEach(cleanup)

const USER_ID = 3

const queueState = (pausedUserIds: number[] = []) => queuePush({
  isLoading: false,
  result: [1],
  entities: { 1: { queueId: 1, songId: 2, userId: USER_ID } },
  pausedUserIds,
} as unknown as Parameters<typeof queuePush>[0])

const Where = () => <output data-testid='where'>{useLocation().pathname}</output>

const renderHeader = (path = '/') => {
  const emitted: UnknownAction[] = []
  const socket = {
    on: () => {},
    emit: (event: string, action: UnknownAction) => emitted.push(action),
  } as unknown as Socket

  const store = configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware => getDefaultMiddleware()
      .concat(createSocketMiddleware(socket, 'server/')),
  })

  // a signed-in singer with one song queued, and a player in the room —
  // otherwise the header has no status to report and YourTurn never renders
  store.dispatch({ type: ACCOUNT_RECEIVE, payload: { userId: USER_ID } })
  store.dispatch({ type: PLAYER_STATUS, payload: {} })
  store.dispatch(queueState())

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Header />
        <Where />
      </MemoryRouter>
    </Provider>,
  )

  return { store, emitted }
}

describe('YourTurn pause against the real store', () => {
  it('asks the server to take the singer out of the rotation', () => {
    const { store, emitted } = renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Pause my songs' }))

    expect(emitted).toEqual([expect.objectContaining({ type: QUEUE_PAUSE, payload: { isPaused: true } })])
    // II goes to the queue, where the hold is shown (07c)
    expect(screen.getByTestId('where').textContent).toBe('/queue')
    // sitting out is recorded on the server; nothing local has moved yet
    expect(ensureState(store.getState().queue).pausedUserIds).toEqual([])
    expect(screen.getByRole('button', { name: 'Pause my songs' })).toBeTruthy()
  })

  it('reads paused from the pushed state, and asks to come back from there', () => {
    const { store, emitted } = renderHeader()

    act(() => {
      store.dispatch(queueState([USER_ID]))
    })

    expect(ensureState(store.getState().queue).pausedUserIds).toEqual([USER_ID])
    expect(screen.getByText('Paused')).toBeTruthy()
    expect(screen.getByText('1 song on hold')).toBeTruthy()

    // the toggle now reads the other way, which is the state having reached it
    fireEvent.click(screen.getByRole('button', { name: 'Resume my songs' }))
    expect(emitted).toEqual([expect.objectContaining({ type: QUEUE_PAUSE, payload: { isPaused: false } })])
    // resuming lands on the queue too (07)
    expect(screen.getByTestId('where').textContent).toBe('/queue')
  })

  it('leaves another singer\'s pause alone', () => {
    const { store } = renderHeader()

    act(() => {
      store.dispatch(queueState([USER_ID + 1]))
    })

    expect(screen.getByRole('button', { name: 'Pause my songs' })).toBeTruthy()
    expect(screen.queryByText('Paused')).toBeNull()
  })

  it('starts the meter empty and fills it as the wait ticks down', () => {
    // The scale is the singer's OWN wait when the song became their next, so
    // they start at the bottom and climb. Measuring against the room's furthest
    // wait instead let songs queued BEHIND them set their starting point —
    // someone six minutes out opened two thirds full.
    const { store } = renderHeader()

    const level = () => Number(screen.getByRole('meter').getAttribute('aria-valuenow'))
    const play = (position: number) => act(() => {
      store.dispatch({ type: PLAYER_STATUS, payload: { queueId: 9, position } })
    })

    act(() => {
      store.dispatch({
        type: LIBRARY_PUSH,
        payload: {
          artists: { result: [], entities: {} },
          songs: {
            result: [2, 4],
            entities: {
              2: { songId: 2, artistId: 1, title: 'Mine', duration: 100, numMedia: 1 },
              4: { songId: 4, artistId: 1, title: 'Playing', duration: 200, numMedia: 1 },
            },
          },
        },
      })
      // someone else is on stage; my song waits behind theirs
      store.dispatch(queuePush({
        isLoading: false,
        result: [9, 1],
        entities: {
          9: { queueId: 9, songId: 4, userId: USER_ID + 1 },
          1: { queueId: 1, songId: 2, userId: USER_ID },
        },
        pausedUserIds: [],
      } as unknown as Parameters<typeof queuePush>[0]))
    })

    play(0)
    const atStart = level()

    play(100) // halfway through the song ahead of me
    const halfway = level()

    play(190)
    const nearlyUp = level()

    expect(atStart).toBeLessThan(0.1) // the floor, not two thirds full
    expect(halfway).toBeGreaterThan(atStart)
    expect(nearlyUp).toBeGreaterThan(halfway)

    // the time and the meter read the same wait; it used to come from a
    // second selector that walked the queue for the same number
    expect(document.querySelector('.wait')?.textContent).toBe('10s')
  })
})

describe('Header chrome', () => {
  it('draws the VS key live, and says so when the room has battles off', () => {
    const { store } = renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Start a singer battle' }))
    expect(store.getState().ui.errorMessage).toBe('Singer battles are switched off for this room.')
  })

  it('draws the brand row alone on tonight\'s scores', () => {
    renderHeader('/leaderboard')

    expect(screen.getByRole('img', { name: 'KaraokeArcade' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pause my songs' })).toBeNull()
  })

  it('draws nothing before sign-in: onboarding has its own HUD', () => {
    const store = configureStore({ reducer: rootReducer })
    const { container } = render(
      <Provider store={store}>
        <MemoryRouter><Header /></MemoryRouter>
      </Provider>,
    )

    expect(container.firstElementChild?.childElementCount).toBe(0)
  })
})
