// @vitest-environment happy-dom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { UnknownAction } from '@reduxjs/toolkit'
import { battleInvite } from 'lib/battleFixtures'
import { BATTLE_ACCEPT, BATTLE_DECLINE } from 'shared/actionTypes'
import { BATTLE_INVITE_MS } from 'shared/types'
import type { BattleInvite, BattleSinger } from 'shared/types'
import Invite from './BattleInvite'

/**
 * Answering somebody who picked you: Arcade Flow v2 13b.
 *
 * The same invite object reaches both phones, so the first thing asserted is
 * that this screen only ever appears on the opponent's: get that wrong and the
 * challenger is asked to accept their own challenge.
 *
 * The rest is the deal itself. The song is on the ask, because agreeing
 * without it is signing a blank. And the clock ends the offer on its own — an
 * invite left open all night is a turn nobody can spend.
 */

afterEach(cleanup)

const CHALLENGER = 1
const ME = 2

const open = ({ userId = ME, invite = battleInvite(), avatarId = 'p2' }: {
  userId?: number
  invite?: BattleInvite | null
  avatarId?: string | null
}) => {
  const dispatched: UnknownAction[] = []

  const state = {
    battle: { singers: [] as BattleSinger[], pending: null as BattleSinger | null, invite },
    user: { userId, name: 'D_TEES', roomId: null as number | null, avatarId },
    rooms: { entities: {} },
    // Africa, the fixture's song: 4:55
    songs: { entities: { 11: { songId: 11, duration: 295 } } },
  }
  const store = {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: (action: UnknownAction) => {
      dispatched.push(action)
      return action
    },
  }

  render(
    <Provider store={store as never}>
      <MemoryRouter>
        <Invite />
      </MemoryRouter>
    </Provider>,
  )

  return { dispatched }
}

describe('BattleInvite', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => vi.useRealTimers())

  it('asks the opponent, and says what they would be agreeing to', () => {
    open({})

    expect(screen.getByText('Incoming')).toBeTruthy()
    expect(screen.getByText('Challenger')).toBeTruthy()
    expect(screen.getByText('Dot Matrix')).toBeTruthy()
    expect(screen.getByText('wants a battle')).toBeTruthy()
    expect(screen.getByText('You\'ll sing')).toBeTruthy()
    expect(screen.getByText('Africa')).toBeTruthy()
    expect(screen.getByText('Toto · 4:55')).toBeTruthy()
    expect(screen.getByText('Picked by Dot Matrix')).toBeTruthy()
    expect(screen.getByText('Win +1000')).toBeTruthy()
    expect(screen.getByText('Play +250')).toBeTruthy()
    expect(screen.getByText('Next · you pick the song Dot Matrix sings')).toBeTruthy()
  })

  it('stands the challenger in their own room, full figure', () => {
    open({})

    const art = Array.from(document.querySelectorAll('img')).map(img => img.getAttribute('src'))

    expect(art).toContain('assets/battle/fighters/default/belter/location.png')
    expect(art).toContain('assets/battle/fighters/default/belter/views/key.png')
  })

  it('never asks the challenger to answer their own challenge', () => {
    open({ userId: CHALLENGER })

    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
  })

  it('accepts in one tap, as the character on the account', () => {
    const { dispatched } = open({})

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

    expect(dispatched.map(a => a.type)).toEqual([BATTLE_ACCEPT])
    expect(dispatched[0].payload).toEqual({ singerId: 'p2' })
    // straight to the library to pick their song: the ask is done
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
  })

  it('lets both fighters be the same character', () => {
    // The fighter is the account's, so there is no moment in a challenge at
    // which to refuse one.
    const { dispatched } = open({ avatarId: 'p1' })

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

    expect(dispatched[0].payload).toEqual({ singerId: 'p1' })
  })

  it('declines as a decision', () => {
    const { dispatched } = open({})

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(dispatched.map(a => a.type)).toEqual([BATTLE_DECLINE])
  })

  it('has no way to put the challenge down unanswered', () => {
    open({})

    expect(screen.queryByRole('button', { name: /Cancel|Back/ })).toBeNull()
  })

  it('runs out on its own', () => {
    open({ invite: battleInvite({ expiresAt: Date.now() + BATTLE_INVITE_MS }) })

    expect(screen.getByText('0:30')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(BATTLE_INVITE_MS)
    })

    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
  })

  it('is not the surface once this phone is off picking a song', () => {
    open({ invite: battleInvite({ isAccepted: true, opponentSingerId: 'p2' }) })

    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
  })
})
