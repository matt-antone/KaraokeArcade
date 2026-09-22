// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { RequireAuth } from './Routes'

// The picker lists fighter folders off the server. Nothing here is about that
// listing, and without this the grid tries to reach a dev server that is not
// running; the shipped eight are what it falls back to anyway.
vi.mock('lib/fighterSets', () => ({
  useFighterListing: () => ({}),
}))

/**
 * The sign-in gate: an account with nobody to be is asked who they are before
 * it is let anywhere.
 *
 * Two things are worth pinning here and they are both regressions waiting to
 * happen rather than features:
 *
 *  - `/player` is exempt. It is the television. It signs in as an admin,
 *    nothing backfills an avatar for it, and a gate that forgets this puts a
 *    character picker on the TV the first time a room boots after the
 *    migration — in front of a room, with no phone attached to dismiss it.
 *  - the predicate is falsy, not `=== null`. The user slice is persisted, so a
 *    store rehydrated from a version that shipped before the column has no key
 *    there at all and reads `undefined`. `=== null` would let that session
 *    straight through with no character, and every surface would draw them as
 *    the default fighter forever.
 *
 * RequireAuth is rendered directly with a stand-in for the route behind it.
 * Standing the real views up to ask one question about the gate would be
 * testing the views, and the gate's whole job is whether the thing behind it
 * renders at all.
 */

afterEach(cleanup)

/** One frozen state object per store: useSyncExternalStore compares snapshots
 *  by identity, so a getState that builds a fresh one each call spins. */
const fakeStore = (user: Record<string, unknown>) => {
  const state = {
    user: { userId: 1, name: 'Dot Matrix', roomId: null as number | null, isAdmin: true, ...user },
    rooms: { entities: {} },
  }

  return {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: () => {},
  } as never
}

const renderAt = (path: string, user: Record<string, unknown>) => render(
  <Provider store={fakeStore(user)}>
    <MemoryRouter initialEntries={[path]}>
      <RequireAuth path={path} redirectTo='/'>
        <div>THE ROUTE</div>
      </RequireAuth>
    </MemoryRouter>
  </Provider>,
)

/** Whatever the gate was standing in front of. */
const route = () => screen.queryByText('THE ROUTE')

/** The picker's masthead, which no other screen shows. */
const picker = () => screen.queryByText(/THIS IS WHO SINGS FOR YOU TONIGHT/)

describe('the sign-in avatar gate', () => {
  it('asks a signed-in account with no character who they are', () => {
    renderAt('/queue', { avatarId: null })

    expect(picker()).not.toBeNull()
    // and the route behind it does not render: being asked is the whole screen
    expect(route()).toBeNull()
  })

  it('treats a rehydrated store with no key at all as unanswered', () => {
    // exactly what redux-persist hands back for a session that predates 020
    renderAt('/queue', {})

    expect(picker()).not.toBeNull()
  })

  it('lets an account that has already picked straight through', () => {
    renderAt('/queue', { avatarId: 'p3' })

    expect(picker()).toBeNull()
    expect(route()).not.toBeNull()
  })

  it('never puts the picker on the television', () => {
    renderAt('/player', { avatarId: null })

    expect(picker()).toBeNull()
    expect(route()).not.toBeNull()
  })
})
