// @vitest-environment happy-dom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { UnknownAction } from '@reduxjs/toolkit'
import { battleInvite, battleSinger } from 'lib/battleFixtures'
import { BATTLE_PICK_MODE_EXIT } from 'shared/actionTypes'
import type { BattleInvite, BattleSinger } from 'shared/types'
import BattleSetup from './BattleSetup'

/**
 * The challenger's four steps, and the two ways out of them.
 *
 * What is asserted here is the negotiation, not the arcade: that the selection
 * is never empty (a dead NEXT is a dead end), that the room is the whole
 * population and search cannot reach past it, that nothing leaves this device
 * before CONFIRM, and that confirming carries BOTH halves of what was chosen —
 * the opponent and the singer. The singer is the half that is easy to drop,
 * because it was picked three steps earlier and nothing on the confirm screen
 * would look wrong without it.
 *
 * Every step change runs under an iris that lands its patch 170ms in, so the
 * clock is driven by hand throughout.
 */

afterEach(cleanup)

const ME = 1
const THEM = 2

/** Past the iris cover and the burst, so a step change has fully landed. */
const settle = () => act(() => {
  vi.advanceTimersByTime(500)
})

interface FakeState {
  isOpen?: boolean
  outcome?: 'accepted' | 'declined' | 'timeout' | null
  singers?: BattleSinger[]
  invite?: BattleInvite | null
}

const open = ({ isOpen = true, outcome = null, singers = [], invite = null }: FakeState) => {
  const dispatched: UnknownAction[] = []
  const closed: true[] = []

  const store = {
    getState: () => ({
      battle: { singers, pending: null as BattleSinger | null, invite },
      user: { userId: ME, name: 'MIRA_K' },
    }),
    subscribe: () => () => {},
    dispatch: (action: UnknownAction) => {
      dispatched.push(action)
      return action
    },
  }

  render(
    <Provider store={store as never}>
      <MemoryRouter>
        <BattleSetup isOpen={isOpen} outcome={outcome} onClose={() => closed.push(true)} />
      </MemoryRouter>
    </Provider>,
  )

  return { dispatched, closed }
}

/** Step one to the opponent list, which is where most of this lives. */
const toOpponents = () => {
  fireEvent.click(screen.getByRole('button', { name: 'NEXT' }))
  settle()
  fireEvent.click(screen.getByRole('button', { name: 'PICK OPPONENT' }))
  settle()
}

describe('BattleSetup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => vi.useRealTimers())

  it('opens on a singer, so NEXT is never the thing stopping somebody', () => {
    open({})

    // the roster is built from the list, locked slots and all
    expect(screen.getAllByText('?').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'NEXT' })).toBeTruthy()
    // and the footer chip names the pick it arrived with
    expect(screen.getByText('SINGS FOR YOU')).toBeTruthy()
  })

  it('remembers who this phone sang as last', () => {
    localStorage.setItem('battleSingerId', 'p1')
    open({})

    fireEvent.click(screen.getByRole('button', { name: 'NEXT' }))
    settle()

    expect(screen.getByText('BELTER')).toBeTruthy()
  })

  it('offers the room, and nothing outside it', () => {
    open({ singers: [battleSinger({ userId: THEM, name: 'D_TEES' }), battleSinger({ userId: 3, name: 'SAL' })] })
    toOpponents()

    expect(screen.getByRole('button', { name: /D_TEES/ })).toBeTruthy()
    expect(screen.getByText('2 OF 2')).toBeTruthy()

    // search filters that list; an empty result is a fact about the room
    fireEvent.change(screen.getByPlaceholderText('SEARCH THE ROOM'), { target: { value: 'zz' } })
    expect(screen.getByText(/NOBODY HERE BY THAT NAME/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /D_TEES/ })).toBeNull()
  })

  it('will not send a challenge to nobody', () => {
    open({ singers: [battleSinger({ userId: THEM, name: 'D_TEES' })] })
    toOpponents()

    const key = screen.getByRole('button', { name: 'PICK SOMEONE IN THE ROOM' })
    expect((key as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /D_TEES/ }))
    expect(screen.getByRole('button', { name: 'BATTLE D_TEES' })).toBeTruthy()
  })

  it('carries both halves of the choice into the library', () => {
    localStorage.setItem('battleSingerId', 'p1')
    const { dispatched, closed } = open({ singers: [battleSinger({ userId: THEM, name: 'D_TEES' })] })

    toOpponents()
    fireEvent.click(screen.getByRole('button', { name: /D_TEES/ }))
    fireEvent.click(screen.getByRole('button', { name: 'BATTLE D_TEES' }))
    settle()

    expect(screen.getByText('YOUR SINGER')).toBeTruthy()
    expect(screen.getByText('BELTER')).toBeTruthy()

    // nothing has left the device yet: a half-formed challenge is nobody's
    expect(dispatched).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM' }))

    // the opponent and the singer, together — see the note at the top. Both
    // ride into pick mode because the challenge is not thrown here: the song
    // is chosen in the library, and by then this screen is gone.
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0].payload).toMatchObject({ singer: { userId: THEM }, singerId: 'p1' })

    // and the screen gets out of the way of the song picking it just started
    act(() => {
      vi.advanceTimersByTime(1200)
    })
    expect(closed).toEqual([true])
    expect(localStorage.getItem('battleSingerId')).toBe('p1')
  })

  it('sends nothing when it is called off', () => {
    const { dispatched, closed } = open({ singers: [battleSinger()] })

    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }))
    act(() => {
      vi.advanceTimersByTime(1200)
    })

    expect(screen.queryByText(/NOTHING SENT/)).toBeTruthy()
    expect(dispatched).toEqual([])
    expect(closed).toEqual([true])
  })

  it('offers another go when the answer is no', () => {
    open({ isOpen: false, outcome: 'declined', singers: [battleSinger({ userId: THEM, name: 'D_TEES' })], invite: battleInvite({ opponentName: 'D_TEES' }) })

    expect(screen.getByText('D_TEES PASSED')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'PICK SOMEONE ELSE' }))
    settle()

    // back into the room rather than back to the start: the singer was never
    // the thing that was turned down
    expect(screen.getByText('HERE TONIGHT')).toBeTruthy()
  })

  it('tells a no-answer apart from a no', () => {
    open({ isOpen: false, outcome: 'timeout', invite: battleInvite() })

    expect(screen.getByText(/THE INVITE RAN OUT/)).toBeTruthy()
  })

  it('stays shut when nothing is happening', () => {
    open({ isOpen: false })
    expect(screen.queryByRole('button', { name: 'NEXT' })).toBeNull()
  })

  it('is not the surface once the answer has been read', () => {
    // BATTLE_PICK_MODE_EXIT is the library's way out, not this screen's — the
    // assertion here is only that dismissing an outcome closes rather than
    // sending anything
    const { dispatched, closed } = open({ isOpen: false, outcome: 'accepted', invite: battleInvite({ isAccepted: true }) })

    fireEvent.click(screen.getByRole('button', { name: 'DONE' }))

    expect(closed).toEqual([true])
    expect(dispatched.map(a => a.type)).not.toContain(BATTLE_PICK_MODE_EXIT)
  })
})
