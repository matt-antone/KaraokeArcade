// @vitest-environment happy-dom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { UnknownAction } from '@reduxjs/toolkit'
import { battleInvite, battleSinger } from 'lib/battleFixtures'
import { BATTLE_CANCEL, BATTLE_PICK_MODE_EXIT } from 'shared/actionTypes'
import { BATTLE_INVITE_MS } from 'shared/types'
import type { BattleInvite, BattleSinger, LeaderboardEntry } from 'shared/types'
import BattleSetup from './BattleSetup'

/**
 * The challenger's phone: 13a (pick your opponent), 13a2 (challenge sent) and
 * 13a3 (no contest).
 *
 * What is asserted is the negotiation, not the arcade: that nothing leaves
 * this device before a song is picked, that picking carries BOTH halves of the
 * choice — the opponent and the singer — and that the room is the whole
 * population.
 */

afterEach(cleanup)

const ME = 1
const THEM = 2

interface FakeState {
  isOpen?: boolean
  outcome?: 'accepted' | 'declined' | 'timeout' | null
  singers?: BattleSinger[]
  invite?: BattleInvite | null
  leaderboard?: Partial<LeaderboardEntry>[]
}

const open = ({ isOpen = true, outcome = null, singers = [], invite = null, leaderboard = [] }: FakeState) => {
  const dispatched: UnknownAction[] = []
  const closed: true[] = []

  let state = {
    battle: { singers, pending: null as BattleSinger | null, invite },
    user: { userId: ME, name: 'MIRA_K', roomId: 5 as number | null, avatarId: 'p1' },
    rooms: { entities: { 5: { name: 'Loveshack' } } },
    points: { leaderboard },
  }
  const listeners = new Set<() => void>()
  const store = {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispatch: (action: UnknownAction) => {
      dispatched.push(action)
      return action
    },
  }

  const tree = (props: { outcome: FakeState['outcome'] }) => (
    <Provider store={store as never}>
      <MemoryRouter>
        <BattleSetup isOpen={isOpen} outcome={props.outcome} onClose={() => closed.push(true)} />
      </MemoryRouter>
    </Provider>
  )
  const { rerender } = render(tree({ outcome }))

  /** The server answering: the invite goes, and CoreLayout reports why. */
  const answer = (next: FakeState['outcome']) => act(() => {
    state = { ...state, battle: { ...state.battle, invite: null } }
    listeners.forEach(listener => listener())
    rerender(tree({ outcome: next }))
  })

  return { dispatched, closed, answer }
}

describe('BattleSetup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => vi.useRealTimers())

  it('opens on 13a: the room, with tonight\'s points beside each face', () => {
    open({
      singers: [battleSinger({ userId: THEM, name: 'D_TEES' }), battleSinger({ userId: 3, name: 'SAL' })],
      leaderboard: [{ userId: THEM, points: 2800 }],
    })

    expect(screen.getByText('BATTLE')).toBeTruthy()
    expect(screen.getByText('Singer battle')).toBeTruthy()
    expect(screen.getByText('Pick your opponent')).toBeTruthy()
    expect(screen.getByText('You pick the song they sing. They pick yours.')).toBeTruthy()
    expect(screen.getByText('Here now')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByRole('button', { name: /D_TEES/ })).toBeTruthy()
    expect(screen.getByText('Tonight 2800')).toBeTruthy()
    // somebody not on the board yet has earned nothing tonight
    expect(screen.getByText('Tonight 0')).toBeTruthy()
  })

  it('shows the room as faces', () => {
    // Picking somebody out of a dark room by reading a list of handles is the
    // thing the avatar is for.
    open({
      singers: [
        battleSinger({ userId: THEM, name: 'D_TEES', avatarId: 'halloween/hex' }),
        battleSinger({ userId: 3, name: 'SAL', avatarId: 'p4' }),
      ],
    })

    const art = Array.from(document.querySelectorAll('img')).map(img => img.getAttribute('src'))

    expect(art).toContain('assets/battle/fighters/halloween/hex/views/portrait-80.png')
    expect(art).toContain('assets/battle/fighters/default/diva/views/portrait-80.png')
  })

  it('will not send a challenge to nobody, and marks the one picked', () => {
    open({ singers: [battleSinger({ userId: THEM, name: 'D_TEES' })] })

    const next = screen.getByRole('button', { name: 'Next · pick their song' }) as HTMLButtonElement
    expect(next.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /D_TEES/ }))

    expect(next.disabled).toBe(false)
    expect(screen.getByRole('button', { name: /D_TEES/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('✓')).toBeTruthy()
  })

  it('carries both halves of the choice into the library', () => {
    const { dispatched, closed } = open({ singers: [battleSinger({ userId: THEM, name: 'D_TEES' })] })

    fireEvent.click(screen.getByRole('button', { name: /D_TEES/ }))

    // nothing has left the device yet: a half-formed challenge is nobody's
    expect(dispatched).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Next · pick their song' }))

    // the opponent and the singer, together. Both ride into pick mode because
    // the challenge is not thrown here: the song is chosen in the library.
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0].payload).toMatchObject({ singer: { userId: THEM }, singerId: 'p1' })
    expect(closed).toEqual([true])
  })

  it('draws one key under the list, as 13a does', () => {
    open({ singers: [battleSinger()] })

    expect(screen.getByRole('button', { name: 'Next · pick their song' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Back to songs' })).toBeNull()
  })

  it('says so when there is nobody to fight, and its one key backs out sending nothing', () => {
    const { dispatched, closed } = open({ singers: [] })

    expect(screen.getByText(/Nobody else is here yet/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Next · pick their song' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Back to songs' }))

    expect(dispatched).toEqual([])
    expect(closed).toEqual([true])
  })

  it('waits on 13a2 once the challenge is out, and can call it off', () => {
    const { dispatched } = open({
      isOpen: false,
      invite: battleInvite({ challengerUserId: ME, opponentName: 'loudlucy', expiresAt: Date.now() + 24_000 }),
    })

    expect(screen.getByText('Loveshack')).toBeTruthy()
    expect(screen.getByText('Sent')).toBeTruthy()
    expect(screen.getByText(/CHALLENGE/)).toBeTruthy()
    expect(screen.getByText('Waiting for loudlucy')).toBeTruthy()
    expect(screen.getByText('0:24')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(4_000)
    })
    expect(screen.getByText('0:20')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel challenge' }))
    expect(dispatched.map(a => a.type)).toEqual([BATTLE_CANCEL])
  })

  it('is not the waiting screen on the phone being asked', () => {
    open({ isOpen: false, invite: battleInvite({ challengerUserId: THEM, opponentUserId: ME }) })

    expect(screen.queryByText('Waiting for Barf')).toBeNull()
  })

  it('offers another go when the answer is no', () => {
    const { answer } = open({
      isOpen: false,
      singers: [battleSinger({ userId: THEM, name: 'D_TEES' })],
      invite: battleInvite({ challengerUserId: ME, opponentName: 'D_TEES', expiresAt: Date.now() + BATTLE_INVITE_MS }),
    })

    expect(screen.getByText('Waiting for D_TEES')).toBeTruthy()
    answer('declined')

    // the invite is gone by now, and 13a3 still names who passed
    expect(screen.getByText(/CONTEST/)).toBeTruthy()
    expect(screen.getByText('Declined')).toBeTruthy()
    expect(screen.getByText('D_TEES')).toBeTruthy()
    expect(screen.getByText(/passed on this one\. Challenges expire after 30 seconds without an answer\./)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Pick someone else' }))

    // back into the room: the singer was never the thing that was turned down
    expect(screen.getByText('Pick your opponent')).toBeTruthy()
  })

  it('says the same thing when nobody answered', () => {
    const { answer } = open({ isOpen: false, invite: battleInvite({ challengerUserId: ME }) })
    answer('timeout')

    expect(screen.getByText(/CONTEST/)).toBeTruthy()
    expect(screen.getByText(/Challenges expire after 30 seconds/)).toBeTruthy()
  })

  it('stays shut when nothing is happening', () => {
    open({ isOpen: false })
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('draws nothing once the challenge is accepted', () => {
    // BATTLE_PICK_MODE_EXIT is the library's way out, not this screen's
    const { dispatched } = open({
      isOpen: false,
      outcome: 'accepted',
      invite: battleInvite({ challengerUserId: ME, isAccepted: true }),
    })

    expect(screen.queryByRole('button')).toBeNull()
    expect(dispatched.map(a => a.type)).not.toContain(BATTLE_PICK_MODE_EXIT)
  })
})
