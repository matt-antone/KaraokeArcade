// @vitest-environment happy-dom
import React from 'react'
import { Provider } from 'react-redux'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { battleTurn } from 'lib/battleFixtures'
import { BATTLE_SING_MS, BATTLE_METER_MS, BATTLE_WINNER_MS } from 'shared/types'
import type { BattlePhase, BattleTurn } from 'shared/types'
import BattleStrip from './BattleStrip'

/**
 * The phone's caption on a battle it cannot see.
 *
 * Same shape as PlayerBattle's walk and for the same reason: every beat
 * renders something plausible, so a strip that names the challenger over the
 * opponent's song is only wrong in sequence. This checks the two things the
 * strip alone can get wrong — which fighter each beat is about, and which
 * beats are allowed to show a grade.
 */

const SERVER_T0 = 1_700_000_000_000

const at = (serverMs: number) => vi.setSystemTime(SERVER_T0 + serverMs)

const beat = (phase: BattlePhase, from: number, ms: number, over: Partial<BattleTurn> = {}): BattleTurn =>
  battleTurn({ phase, sentAt: SERVER_T0 + from, endsAt: SERVER_T0 + from + ms, ...over })

const screen = (turn: BattleTurn | null) => {
  const state = { battle: { turn } }
  const store = {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: () => {},
  } as never

  return renderToStaticMarkup(
    <Provider store={store}>
      <BattleStrip />
    </Provider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('the battle strip', () => {
  it('says nothing when no battle is on', () => {
    vi.useFakeTimers()
    at(0)

    expect(screen(null)).toBe('')
  })

  it('follows the microphone from one fighter to the other', () => {
    vi.useFakeTimers()

    at(0)
    const sing1 = screen(beat('sing1', 0, BATTLE_SING_MS))
    expect(sing1).toContain('Dot Matrix')
    expect(sing1).toContain('Barracuda')
    expect(sing1).toContain('2:00')
    // the other fighter's half of the row is not this beat's business
    expect(sing1).not.toContain('Africa')

    at(130_000)
    const sing2 = screen(beat('sing2', 130_000, BATTLE_SING_MS))
    expect(sing2).toContain('Barf')
    expect(sing2).toContain('Africa')
    expect(sing2).not.toContain('Barracuda')
  })

  it('shows grades only once there is something graded', () => {
    vi.useFakeTimers()

    // Both scores are 0 through the singing, and a strip reading "0 — 0" for
    // four minutes looks like a fight nobody is winning rather than one that
    // has not been judged yet.
    at(0)
    expect(screen(beat('sing1', 0, BATTLE_SING_MS))).not.toContain('scores')

    at(260_000)
    const meter = screen(beat('meter1', 260_000, BATTLE_METER_MS, { challengerScore: 61 }))
    expect(meter).toContain('cheer for')
    expect(meter).toContain('61')

    at(290_000)
    const winner = screen(beat('winner', 290_000, BATTLE_WINNER_MS, {
      challengerScore: 41,
      opponentScore: 88,
    }))
    expect(winner).toContain('Barf wins')
    expect(winner).toContain('41')
    expect(winner).toContain('88')
  })

  it('calls a level score a draw', () => {
    vi.useFakeTimers()
    at(290_000)

    const drawn = screen(beat('winner', 290_000, BATTLE_WINNER_MS, {
      challengerScore: 50,
      opponentScore: 50,
    }))
    expect(drawn).toContain('Draw')
    expect(drawn).not.toContain('wins')
  })

  it('goes quiet the moment the last beat runs out', () => {
    vi.useFakeTimers()

    // The store keeps the last beat until the server clears it, which is right
    // for a store and wrong for a strip: the verdict would sit in the chrome
    // over the next singer's song.
    //
    // Seen live first, on purpose. serverNow measures its clock offset the
    // first time it is handed a payload, so a beat whose only sighting is
    // after its own deadline reads as having just arrived — which is the
    // correction working, not the expiry failing.
    const last = beat('winner', 290_000, BATTLE_WINNER_MS)
    at(290_000)
    expect(screen(last)).toContain('result')

    at(290_000 + BATTLE_WINNER_MS + 1)
    expect(screen(last)).toBe('')
  })
})
