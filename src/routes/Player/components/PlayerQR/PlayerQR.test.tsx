// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Provider } from 'react-redux'
import { cleanup, render, screen } from '@testing-library/react'
import type { IRoomPrefs } from 'shared/types'
import PlayerQR from './PlayerQR'

// react-qrcode-logo renders to a canvas, so the encoded value isn't readable
// from the DOM. Swap it for a stub that puts the value in a data attribute.
vi.mock('react-qrcode-logo', () => ({
  QRCode: (props: { value: string }) => <div data-testid='qr' data-value={props.value} />,
}))

afterEach(cleanup)

const prefs = { isEnabled: true, opacity: 1, password: '', size: 0.5 } as IRoomPrefs['qr']

// just enough store for the connected component's hooks. useSelector reads
// via getState() on every render to check for changes, so it must keep
// returning the same object reference or react-redux treats it as always-new
// and loops forever.
const makeStore = (serverUrl: string | undefined) => {
  const state = {
    user: { roomId: 7 },
    prefs: { serverUrl },
  }

  return {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: () => {},
  } as never
}

const renderQR = (serverUrl: string | undefined) => {
  render(
    <Provider store={makeStore(serverUrl)}>
      <PlayerQR height={720} prefs={prefs} />
    </Provider>,
  )

  return screen.getByTestId('qr').getAttribute('data-value')
}

describe('PlayerQR join URL', () => {
  it('encodes the server\'s LAN address, not the browser\'s own', () => {
    const value = renderQR('http://192.168.86.235:3739/')

    expect(value).toMatch(/^http:\/\/192\.168\.86\.235:3739\//)
    expect(value).toContain('roomId=7')
    expect(value?.startsWith(window.location.origin)).toBe(false)
  })

  it('falls back to the browser location when the server reports no LAN address', () => {
    const value = renderQR(undefined)

    expect(value?.startsWith(window.location.origin)).toBe(true)
  })
})
