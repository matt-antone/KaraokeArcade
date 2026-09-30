// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Provider } from 'react-redux'
import { cleanup, render, screen } from '@testing-library/react'
import type { IRoomPrefs, LeaderboardEntry } from 'shared/types'
import PlayerScores from './PlayerScores'

// react-qrcode-logo renders to a canvas, so the encoded value isn't readable
// from the DOM. Swap it for a stub that puts the value in a data attribute.
vi.mock('react-qrcode-logo', () => ({
  QRCode: (props: { value: string }) => <div data-testid='qr' data-value={props.value} />,
}))

afterEach(cleanup)

const leaderboard = [
  { userId: 1, name: 'loudlucy', avatarId: null, points: 1200 },
  { userId: 2, name: 'jumpinjammer', avatarId: null, points: 900 },
] as LeaderboardEntry[]

// just enough store for the hooks. useSelector reads via getState() on every
// render to check for changes, so it must keep returning the same object
// reference or react-redux treats it as always-new and loops forever.
const makeStore = (qr: Partial<IRoomPrefs['qr']> | undefined) => {
  const state = {
    user: { roomId: 7 },
    prefs: { serverUrl: 'http://192.168.86.235:3739/' },
    ui: { innerHeight: 1080 },
    rooms: { entities: { 7: { roomId: 7, prefs: qr ? { qr } : undefined } } },
  }

  return {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: () => {},
  } as never
}

const renderScores = (qr: Partial<IRoomPrefs['qr']> | undefined) => render(
  <Provider store={makeStore(qr)}>
    <PlayerScores leaderboard={leaderboard} venue='Loveshack' />
  </Provider>,
)

describe('PlayerScores join code', () => {
  it('shows the room\'s join code, built from the server\'s LAN address', () => {
    renderScores({ isEnabled: true, password: 'hunter2' })

    const value = screen.getByTestId('qr').getAttribute('data-value')
    expect(value).toMatch(/^http:\/\/192\.168\.86\.235:3739\//)
    expect(value).toContain('roomId=7')
    expect(value).toContain(`password=${encodeURIComponent(btoa('hunter2'))}`)
    expect(screen.getByText('Scan to play')).toBeTruthy()
    expect(screen.getByText('No singing necessary')).toBeTruthy()
    // the board is still all there beside it
    expect(screen.getByText('loudlucy')).toBeTruthy()
  })

  it('shows no code when the room has "Show QR code" off', () => {
    renderScores({ isEnabled: false })

    expect(screen.queryByTestId('qr')).toBeNull()
    expect(screen.queryByText('Scan to play')).toBeNull()
    expect(screen.getByText('loudlucy')).toBeTruthy()
  })

  it('shows no code when the room has no prefs yet', () => {
    renderScores(undefined)

    expect(screen.queryByTestId('qr')).toBeNull()
  })
})

describe('PlayerScores play key', () => {
  const renderIdle = (qr: Partial<IRoomPrefs['qr']> | undefined, onPlay?: () => void) => render(
    <Provider store={makeStore(qr)}>
      <PlayerScores leaderboard={leaderboard} venue='Loveshack' onPlay={onPlay} />
    </Provider>,
  )

  it('offers Start while the TV is idle, under the code, and presses through', () => {
    const onPlay = vi.fn()
    renderIdle({ isEnabled: true }, onPlay)

    screen.getByRole('button', { name: 'Start' }).click()
    expect(onPlay).toHaveBeenCalledOnce()
    expect(screen.getByTestId('qr')).toBeTruthy()
  })

  it('still offers Start when the room shows no code', () => {
    renderIdle({ isEnabled: false }, vi.fn())

    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy()
    expect(screen.queryByTestId('qr')).toBeNull()
  })

  it('has no Start once something has been asked to play', () => {
    renderIdle({ isEnabled: true })

    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull()
  })
})
