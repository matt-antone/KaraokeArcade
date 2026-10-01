// @vitest-environment happy-dom
import React from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import TriviaDialog from './TriviaDialog'
import { triviaResult, triviaRound } from 'lib/triviaFixtures'
import { TRIVIA_FINAL_REST_MS } from 'shared/types'

/**
 * The final rests "until it is put away" (TriviaDialog.test.tsx), which is
 * right for a guest reading their standing and wrong for a phone nobody is
 * holding: this screen is a native `<dialog>`, which sits in the browser's
 * top layer above every other screen regardless of z-index, so left open it
 * blocks whatever the room needs that phone for next — a battle ballot most
 * visibly. It has to put itself away eventually.
 */

const open = (boardFrom: number) => {
  const state = {
    trivia: {
      round: triviaRound({ endsAt: Date.now() - 9000 }),
      result: triviaResult({
        isFinal: true,
        standings: [{ userId: 7, name: 'Dot Matrix', avatarId: 'p1', points: 1100, numCorrect: 5 }],
        scoresFrom: Date.now() - 20000,
        boardFrom,
        endsAt: Date.now() - 9000,
      }),
      answeredIdx: null as number | null,
      resolvedQueueId: null as number | null,
    },
    user: { userId: 7, roomId: 1, avatarId: 'p1' },
    rooms: { entities: { 1: { name: 'Loveshack' } }, singerCount: 9 },
    status: {},
    points: { leaderboard: [] as never[] },
  }
  const store = { getState: () => state, subscribe: () => () => {}, dispatch: () => {} }

  render(
    <Provider store={store as never}>
      <MemoryRouter>
        <TriviaDialog />
      </MemoryRouter>
    </Provider>,
  )
}

describe('TriviaDialog final timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('rests on the final board once it has just come up', () => {
    open(Date.now() - 500)

    expect(screen.getByText('YOU WIN')).toBeTruthy()
  })

  it('puts the final away on its own once nobody has', () => {
    const boardFrom = Date.now() - 500

    open(boardFrom)
    expect(screen.getByText('YOU WIN')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(TRIVIA_FINAL_REST_MS)
    })

    expect(screen.queryByText('YOU WIN')).toBeNull()
    expect(screen.queryByText('Back to songs')).toBeNull()
  })

  it('does not clear it early', () => {
    const boardFrom = Date.now() - 500

    open(boardFrom)

    act(() => {
      vi.advanceTimersByTime(TRIVIA_FINAL_REST_MS - 5000)
    })

    expect(screen.getByText('YOU WIN')).toBeTruthy()
  })
})
