// @vitest-environment happy-dom
import React from 'react'
import { Provider } from 'react-redux'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { battleTurn } from 'lib/battleFixtures'
import {
  BATTLE_INTRO_MS,
  BATTLE_JUDGE_MS,
  BATTLE_METER_MS,
  BATTLE_SING_MS,
  BATTLE_VERSUS_MS,
  BATTLE_WINNER_MS,
} from 'shared/types'
import type { BattlePhase, BattleTurn } from 'shared/types'
import PlayerBattle from './PlayerBattle'

/**
 * Nine beats, walked in order at the times the server would send them.
 *
 * This exists because a battle is the one screen in the app where being wrong
 * is silent. Every beat renders *something* plausible, so a component that
 * shows the challenger's name over the opponent's song, or leaves the last
 * beat's splash up over the next singer, or draws a crowd meter on a player
 * that cannot hear the room, looks fine in isolation and is only wrong in
 * sequence. Driving the real payloads through the real clock correction is the
 * only way to see it.
 *
 * happy-dom because UserImage builds its src from document.baseURI during
 * render. No afterEach(cleanup): nothing is mounted — renderToStaticMarkup
 * returns a string and runs no effects, which is also what keeps the canvas
 * sting and the microphone out of a test that has neither.
 */

const SERVER_T0 = 1_700_000_000_000
/** The TV box's clock is a minute behind the server's, as a TV box's is. Every
 *  beat below is placed on the server's clock and read on this one. */
const SKEW = -60_000

/** Wind both clocks to a moment on the server's timeline. */
const at = (serverMs: number) => vi.setSystemTime(SERVER_T0 + serverMs + SKEW)

const beat = (phase: BattlePhase, from: number, ms: number, over: Partial<BattleTurn> = {}): BattleTurn =>
  battleTurn({ phase, sentAt: SERVER_T0 + from, endsAt: SERVER_T0 + from + ms, ...over })

/** Just enough store for useBattleStage and useCrowdMic's dispatch. The state
 *  object is kept whole so useSelector's identity check does not spin. */
const screen = (turn: BattleTurn | null, queueId = 7) => {
  const state = { battle: { turn } }
  const store = {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: () => {},
  } as never

  return renderToStaticMarkup(
    <Provider store={store}>
      <PlayerBattle queueId={queueId} getAudioCtx={() => null} width={1280} height={720} />
    </Provider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('a battle, beat by beat', () => {
  it('draws each of the nine beats and only that beat', () => {
    vi.useFakeTimers()

    // --- versus: both fighters, both songs, before a note is played
    const versus = beat('versus', 0, BATTLE_VERSUS_MS)
    at(0)
    const one = screen(versus)
    expect(one).toContain('Dot Matrix')
    expect(one).toContain('Barf')
    expect(one).toContain('Barracuda')
    expect(one).toContain('Africa')

    // --- intro1: the challenger alone, with the song their opponent chose
    at(BATTLE_VERSUS_MS)
    const intro1 = screen(beat('intro1', BATTLE_VERSUS_MS, BATTLE_INTRO_MS))
    expect(intro1).toContain('challenger')
    expect(intro1).toContain('Dot Matrix')
    expect(intro1).toContain('Barracuda')
    expect(intro1).not.toContain('Barf')

    // --- sing1: the overlay gets out of the way. A corner card, the media
    //     behind it, and the two-minute cut counting down.
    at(10_000)
    const sing1 = screen(beat('sing1', 10_000, BATTLE_SING_MS))
    expect(sing1).toContain('Dot Matrix')
    expect(sing1).toContain('Barracuda')
    expect(sing1).toContain('120')
    // the opponent's half of the row is not on screen while the first one sings
    expect(sing1).not.toContain('Africa')
    // and the stage is not covered: the corner card is the whole overlay
    expect(sing1).not.toContain('container')

    // --- intro2: the other fighter, the other colour, the other song
    at(130_000)
    const intro2 = screen(beat('intro2', 130_000, BATTLE_INTRO_MS))
    expect(intro2).toContain('opponent')
    expect(intro2).toContain('Barf')
    expect(intro2).toContain('Africa')
    expect(intro2).not.toContain('Dot Matrix')

    // --- sing2: the corner card follows the microphone
    at(135_000)
    const sing2 = screen(beat('sing2', 135_000, BATTLE_SING_MS))
    expect(sing2).toContain('Barf')
    expect(sing2).toContain('Africa')
    expect(sing2).not.toContain('Barracuda')

    // --- judge: the ask, and nothing else
    at(255_000)
    const judge = screen(beat('judge', 255_000, BATTLE_JUDGE_MS))
    expect(judge).toContain('Who wins')
    expect(judge).toContain('Dot Matrix')
    expect(judge).toContain('Barf')

    // --- meter1: the room is heard for the challenger
    at(260_000)
    const meter1 = screen(beat('meter1', 260_000, BATTLE_METER_MS))
    expect(meter1).toContain('make some noise for')
    expect(meter1).toContain('Dot Matrix')
    expect(meter1).toContain('role="meter"')

    // --- meter2: and for the opponent
    at(275_000)
    const meter2 = screen(beat('meter2', 275_000, BATTLE_METER_MS))
    expect(meter2).toContain('Barf')
    expect(meter2).toContain('role="meter"')

    // --- winner: the verdict and both grades
    at(290_000)
    const winner = screen(beat('winner', 290_000, BATTLE_WINNER_MS, {
      challengerScore: 41,
      opponentScore: 88,
    }))
    expect(winner).toContain('Barf wins')
    expect(winner).toContain('>88<')
    expect(winner).toContain('>41<')
  })

  it('calls it a draw rather than picking one, when both were heard the same', () => {
    vi.useFakeTimers()
    at(290_000)

    const drawn = screen(beat('winner', 290_000, BATTLE_WINNER_MS, {
      challengerScore: 61,
      opponentScore: 61,
    }))

    expect(drawn).toContain('Draw')
    expect(drawn).not.toContain('wins')
  })
})

describe('a player that cannot hear the room', () => {
  it('never draws a crowd meter, and says why the verdict is a draw', () => {
    vi.useFakeTimers()

    // The seven beats such a battle actually has: the server skips meter1 and
    // meter2 entirely rather than showing the room two bars that never move.
    const silent: BattlePhase[] = ['versus', 'intro1', 'sing1', 'intro2', 'sing2', 'judge', 'winner']

    for (const [i, phase] of silent.entries()) {
      const from = i * 10_000
      at(from)
      expect(screen(beat(phase, from, 5_000, { judging: 'none' })))
        .not.toContain('role="meter"')
    }

    at(0)
    const verdict = screen(beat('winner', 0, BATTLE_WINNER_MS, { judging: 'none' }))
    expect(verdict).toContain('Draw')
    expect(verdict).toContain('cannot hear the room')
  })
})

describe('a beat that is not ours', () => {
  it('holds the stage rather than drawing somebody else\'s battle', () => {
    vi.useFakeTimers()
    at(0)

    // the last beat of the previous row, still in the store as this one starts
    const stale = screen(beat('winner', 0, BATTLE_WINNER_MS), 9)

    expect(stale).toContain('Battle')
    expect(stale).not.toContain('Dot Matrix')
  })

  it('holds the stage while a beat that has run out waits for its successor', () => {
    vi.useFakeTimers()

    // first sight caches the clock correction, exactly as a real arrival does
    const judge = beat('judge', 0, BATTLE_JUDGE_MS)
    at(0)
    expect(screen(judge)).toContain('Who wins')

    // the beat's deadline passes and the next one is still on the wire
    at(BATTLE_JUDGE_MS + 1)
    const gap = screen(judge)
    expect(gap).toContain('Battle')
    expect(gap).not.toContain('Who wins')
  })

  it('holds the stage when there is no battle at all yet', () => {
    vi.useFakeTimers()
    at(0)

    expect(screen(null)).toContain('Battle')
  })
})
