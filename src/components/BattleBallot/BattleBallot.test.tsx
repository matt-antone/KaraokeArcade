// @vitest-environment happy-dom
import React from 'react'
import { Provider } from 'react-redux'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { battleTurn } from 'lib/battleFixtures'
import { BATTLE_BALLOT_MS, BATTLE_WINNER_MS } from 'shared/types'
import type { BattlePhase, BattleSide, BattleTurn } from 'shared/types'
import BattleBallot from './BattleBallot'

/**
 * The ballot is the default way a room decides a battle, and the two ways it
 * can be wrong are both silent: keys in front of a fighter, who would then be
 * voting for themselves where nobody can see it, and a panel that outlives its
 * beat, which would take a vote nothing counts.
 *
 * Static render for the same reasons PlayerBattle's tests use it — no effects
 * run, so the alert cue and its AudioContext stay out of a test that has
 * neither.
 */

const SERVER_T0 = 1_700_000_000_000
/** A phone's clock is never the server's; every beat below is placed on the
 *  server's timeline and read on this one. */
const SKEW = 37_000

const at = (serverMs: number) => vi.setSystemTime(SERVER_T0 + serverMs + SKEW)

const beat = (phase: BattlePhase, ms: number): BattleTurn =>
  battleTurn({ phase, judging: 'ballot', sentAt: SERVER_T0, endsAt: SERVER_T0 + ms })

/** Dot Matrix is the challenger, Barf the opponent, Carol is just watching. */
const CAROL = 3

const screen = (turn: BattleTurn | null, userId = CAROL, vote: { queueId: number, side: BattleSide } | null = null) => {
  const state = { battle: { turn, vote }, user: { userId } }
  const store = {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: () => {},
  } as never

  return renderToStaticMarkup(
    <Provider store={store}>
      <BattleBallot />
    </Provider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('the ballot', () => {
  it('offers both fighters, by name and by what they sang', () => {
    vi.useFakeTimers()
    at(0)

    const pad = screen(beat('ballot', BATTLE_BALLOT_MS))

    expect(pad).toContain('Dot Matrix')
    expect(pad).toContain('Barf')
    // each fighter under the song they actually sang, which is the one the
    // other one picked for them
    expect(pad).toContain('Barracuda')
    expect(pad).toContain('Africa')
    expect(pad).toContain('Nobody sees this')
  })

  it('marks the key this phone pressed, and leaves the other one live', () => {
    vi.useFakeTimers()
    at(0)

    const pad = screen(beat('ballot', BATTLE_BALLOT_MS), CAROL, { queueId: 7, side: 2 })

    expect(pad).toContain('aria-pressed="true"')
    expect(pad).toContain('aria-pressed="false"')
    expect(pad).toContain('Tap the other to change it')
  })

  it('ignores a vote left over from the row before', () => {
    vi.useFakeTimers()
    at(0)

    // the fixture's row is 7; this vote was cast in the battle before it
    const pad = screen(beat('ballot', BATTLE_BALLOT_MS), CAROL, { queueId: 6, side: 1 })

    expect(pad).not.toContain('aria-pressed="true"')
  })

  it('gives the two fighters no keys at all', () => {
    vi.useFakeTimers()
    at(0)

    for (const fighterId of [1, 2]) {
      const pad = screen(beat('ballot', BATTLE_BALLOT_MS), fighterId)

      expect(pad).toContain('in this one')
      expect(pad).not.toContain('aria-pressed')
    }
  })

  it('is not on any other beat, or after its own has run out', () => {
    vi.useFakeTimers()
    at(0)

    expect(screen(beat('winner', BATTLE_WINNER_MS))).toBe('')
    expect(screen(null)).toBe('')

    // first sight caches the clock correction, exactly as a real arrival does
    const ballot = beat('ballot', BATTLE_BALLOT_MS)
    expect(screen(ballot)).toContain('Who wins')

    // the beat's deadline passes and the panel goes with it, rather than
    // taking a vote nothing is left to count
    at(BATTLE_BALLOT_MS + 1)
    expect(screen(ballot)).toBe('')
  })
})
