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
 * Answering somebody who picked you.
 *
 * The same invite object reaches both phones, so the first thing asserted is
 * that this screen only ever appears on the opponent's: get that wrong and the
 * challenger is asked to accept their own challenge.
 *
 * The rest is the deal itself. The song is on the ask, because agreeing
 * without it is signing a blank. The challenger's singer cannot be taken,
 * because two people cannot sing as the same one. And the clock ends the offer
 * on its own — an invite left open all night is a turn nobody can spend.
 */

afterEach(cleanup)

const CHALLENGER = 1
const ME = 2

/** Past the iris cover and the burst, so a step change has fully landed. */
const settle = () => act(() => {
  vi.advanceTimersByTime(500)
})

const open = ({ userId = ME, invite = battleInvite(), avatarId = 'p2' }: {
  userId?: number
  invite?: BattleInvite | null
  avatarId?: string | null
}) => {
  const dispatched: UnknownAction[] = []

  const store = {
    getState: () => ({
      battle: { singers: [] as BattleSinger[], pending: null as BattleSinger | null, invite },
      user: { userId, name: 'D_TEES', roomId: null as number | null, avatarId },
      rooms: { entities: {} },
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

    expect(screen.getByText('Dot Matrix')).toBeTruthy()
    expect(screen.getByText('YOU SING')).toBeTruthy()
    expect(screen.getByText('Africa — Toto')).toBeTruthy()
    expect(screen.getByText(/PICKED BY/)).toBeTruthy()
  })

  it('never asks the challenger to answer their own challenge', () => {
    open({ userId: CHALLENGER })

    expect(screen.queryByRole('button', { name: 'ACCEPT' })).toBeNull()
  })

  it('lets both fighters be the same character, now that nobody picks one here', () => {
    // The old rule was enforced on a grid shown between the ask and the
    // answer, and that grid is gone: the fighter is the account's, so there is
    // no moment in a challenge at which to refuse one. The stage has always
    // drawn two identical defaults for a battle fought before the roster
    // shipped, so this is a case it already handles.
    const { dispatched } = open({ avatarId: 'p1' })

    fireEvent.click(screen.getByRole('button', { name: 'ACCEPT' }))
    settle()
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM' }))

    expect(screen.queryByText('TAKEN')).toBeNull()
    expect(dispatched.map(a => a.type)).toEqual([BATTLE_ACCEPT])
    expect(dispatched[0].payload).toEqual({ singerId: 'p1' })
  })

  it('accepts as the character on the account, one step sooner', () => {
    const { dispatched } = open({})

    fireEvent.click(screen.getByRole('button', { name: 'ACCEPT' }))
    settle()

    // straight to the confirm: no grid in between
    expect(screen.getByText('CONFIRM AND THE ROOM SEES IT')).toBeTruthy()
    expect(screen.queryByText(/PICK A\s*SINGER/)).toBeNull()
    // accepting has sent nothing so far: the confirm screen is the decision
    expect(dispatched).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM' }))

    expect(dispatched.map(a => a.type)).toEqual([BATTLE_ACCEPT])
    expect(dispatched[0].payload).toEqual({ singerId: 'p2' })

    settle()
    expect(screen.getByRole('button', { name: 'PICK THEIR SONG' })).toBeTruthy()
  })

  it('declines as a decision, and says the other side was told', () => {
    const { dispatched } = open({})

    fireEvent.click(screen.getByRole('button', { name: 'DECLINE' }))
    expect(dispatched.map(a => a.type)).toEqual([BATTLE_DECLINE])

    settle()
    expect(screen.getByText('DECLINED')).toBeTruthy()
    expect(screen.getByText(/WAS TOLD/)).toBeTruthy()
  })

  it('has no way to put the challenge down unanswered', () => {
    open({})

    expect(screen.queryByRole('button', { name: 'CANCEL' })).toBeNull()
  })

  it('runs out on its own', () => {
    open({ invite: battleInvite({ expiresAt: Date.now() + BATTLE_INVITE_MS }) })

    expect(screen.getByText('0:45 LEFT')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(BATTLE_INVITE_MS)
    })

    expect(screen.getByText('TOO SLOW')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'ACCEPT' })).toBeNull()
  })

  it('is not the surface once this phone is off picking a song', () => {
    // the library's banner is what carries it from here
    open({ invite: battleInvite({ isAccepted: true, opponentSingerId: 'p2' }) })

    expect(screen.queryByRole('button', { name: 'PICK THEIR SONG' })).toBeNull()
  })
})
