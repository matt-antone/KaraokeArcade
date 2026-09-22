// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Provider } from 'react-redux'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import AvatarPicker from './AvatarPicker'

/**
 * Picking who you are, as an account.
 *
 * Two things this has to get right that the per-battle picker never had to:
 *
 *  - it is the first screen a stranger sees, so NEXT is live on arrival and
 *    nothing pops a browser dialog at them for using it;
 *  - it runs before the room is in the store. A brand-new account reaches this
 *    screen before CoreLayout has fetched the room's prefs, so the shipped
 *    group is all it can honestly show at first. The grid grows by a box when
 *    the prefs land, which beats a spinner in front of a working grid.
 */

// The thunk is stood in for by a plain action: a bare fake store has no thunk
// middleware, so a dispatched thunk arrives as an opaque function and what it
// was called with -- the whole point here -- cannot be read back off it.
vi.mock('store/modules/user', () => ({
  updateAccount: (arg: unknown) => ({ type: 'test/updateAccount', arg }),
}))

vi.mock('lib/fighterSets', () => ({
  useFighterListing: () => ({
    default: { belter: {}, crooner: {} },
    halloween: { hex: {} },
  }),
}))

afterEach(cleanup)

/** Enough store to subscribe to, so a prefs arrival re-renders the grid the
 *  way the real one does — through the component's own selector. */
const makeStore = (initial: Record<string, unknown>) => {
  const listeners = new Set<() => void>()
  let state = initial
  const dispatched: unknown[] = []

  return {
    dispatched,
    setState: (next: Record<string, unknown>) => act(() => {
      state = next
      listeners.forEach(l => l())
    }),
    store: {
      getState: () => state,
      subscribe: (l: () => void) => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
      dispatch: (action: unknown) => {
        dispatched.push(action)
        return action
      },
    } as never,
  }
}

const signedOutOfAnyRoom = { user: { userId: 1, roomId: null as number | null }, rooms: { entities: {} } }

const inRoomWithHalloweenOn = {
  user: { userId: 1, roomId: 5 },
  rooms: { entities: { 5: { prefs: { battle: { groups: { halloween: true } } } } } },
}

const groupLegend = () => screen.queryByText('halloween')

describe('AvatarPicker', () => {
  it('shows the shipped group first and grows when the room lands', () => {
    const { store, setState } = makeStore(signedOutOfAnyRoom)
    render(<Provider store={store}><AvatarPicker /></Provider>)

    // no room in the store yet, so no prefs: `default` is on unless a host
    // turns it off, and every other group is off until one turns it on
    expect(groupLegend()).toBeNull()
    expect(screen.getByLabelText('BELTER')).toBeTruthy()

    setState(inRoomWithHalloweenOn)

    expect(groupLegend()).not.toBeNull()
    expect(screen.getByLabelText('HEX')).toBeTruthy()
  })

  it('arrives with a live NEXT rather than an empty selection', () => {
    const { store, dispatched } = makeStore(signedOutOfAnyRoom)
    render(<Provider store={store}><AvatarPicker /></Provider>)

    fireEvent.click(screen.getByText('NEXT'))

    // without a seeded selection the key would be the thing standing between
    // somebody and the app on their first screen
    expect(dispatched).toHaveLength(1)
  })

  it('writes the chosen fighter to the account, without a success dialog', () => {
    const { store, dispatched } = makeStore(inRoomWithHalloweenOn)
    const onDone = vi.fn()
    render(<Provider store={store}><AvatarPicker onDone={onDone} /></Provider>)

    fireEvent.click(screen.getByLabelText('HEX'))
    fireEvent.click(screen.getByText('NEXT'))

    // the thunk is dispatched with the silent flag: a stranger's first
    // interaction with this app is not a browser alert
    const [thunkArg] = dispatched as [{ arg?: { data: FormData, isSilent?: boolean } }]

    expect(thunkArg.arg?.isSilent).toBe(true)
    expect(thunkArg.arg?.data.get('avatarId')).toBe('halloween/hex')
    expect(onDone).toHaveBeenCalled()
  })
})
