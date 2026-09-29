// @vitest-environment happy-dom
import React from 'react'
import { Provider } from 'react-redux'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { battleTurn } from 'lib/battleFixtures'
import {
  BATTLE_INTRO_MS,
  BATTLE_JUDGE_BALLOT_MS,
  BATTLE_JUDGE_MS,
  BATTLE_METER_MS,
  BATTLE_SING_MS,
  BATTLE_VERSUS_MS,
  BATTLE_WINNER_MS,
} from 'shared/types'
import type { BattlePhase, BattleTurn, LeaderboardEntry } from 'shared/types'
import PlayerBattle from './PlayerBattle'

/**
 * Every beat, walked in order at the times the server would send them.
 *
 * This exists because a battle is the one screen in the app where being wrong
 * is silent. Every beat renders *something* plausible, so a stage that shows
 * the challenger's name over the opponent's song, or puts the video panel on
 * the side the singer is standing on, or draws a crowd meter on a player that
 * cannot hear the room, looks fine in isolation and is only wrong in sequence.
 * Driving the real payloads through the real clock correction is the only way
 * to see it.
 *
 * Class names are asserted in a few places and that is deliberate rather than
 * lazy: the mirrored halves of the two singing beats and the hole cut in the
 * plate for the karaoke video are pure geometry, with no text to check them by,
 * and getting them the wrong way round puts the fighter on top of the lyrics.
 * config/vitest.config.ts hands back the CSS module key, so `panelOne` in the
 * markup really is .panelOne in PlayerBattle.css.
 *
 * happy-dom because the sprite preloader builds an Image. No afterEach(cleanup)
 * and no cleanup of it either: nothing is mounted — renderToStaticMarkup
 * returns a string and runs no effects, which is also what keeps the microphone
 * and a hundred PNG fetches out of a test that wants neither.
 */

const SERVER_T0 = 1_700_000_000_000
/** The TV box's clock is a minute behind the server's, as a TV box's is. Every
 *  beat below is placed on the server's clock and read on this one. */
const SKEW = -60_000

/** Wind both clocks to a moment on the server's timeline. */
const at = (serverMs: number) => vi.setSystemTime(SERVER_T0 + serverMs + SKEW)

/** Where the two singing beats start, summed from the beat lengths the way
 *  Battle.test.ts does rather than written as the numbers they add up to. */
const TO_SING1 = BATTLE_VERSUS_MS + BATTLE_INTRO_MS
const TO_SING2 = TO_SING1 + BATTLE_SING_MS + BATTLE_INTRO_MS

const beat = (phase: BattlePhase, from: number, ms: number, over: Partial<BattleTurn> = {}): BattleTurn =>
  battleTurn({ phase, sentAt: SERVER_T0 + from, endsAt: SERVER_T0 + from + ms, ...over })

/** Just enough store for useBattleStage, the venue, tonight's points and
 *  useCrowdMic's dispatch. The state object is kept whole so useSelector's
 *  identity check does not spin. */
const stateOf = (turn: BattleTurn | null, leaderboard: Partial<LeaderboardEntry>[] = []) => ({
  battle: { turn },
  user: { roomId: 5 },
  rooms: { entities: { 5: { name: 'Loveshack' } } },
  points: { leaderboard },
})

const screen = (turn: BattleTurn | null, queueId = 7, leaderboard: Partial<LeaderboardEntry>[] = []) => {
  const state = stateOf(turn, leaderboard)
  const store = {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: () => {},
  } as never

  return renderToStaticMarkup(
    <Provider store={store}>
      <PlayerBattle
        queueId={queueId}
        getAudioCtx={() => null}
        width={1280}
        height={720}
      />
    </Provider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

/** The same tree as `screen`, actually mounted. Only the plate's onError needs
 *  this; everything else is asserted off the markup, which runs no effects. */
const mount = (turn: BattleTurn) => {
  const state = stateOf(turn)
  const store = {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: () => {},
  } as never

  return render(
    <Provider store={store}>
      <PlayerBattle queueId={7} getAudioCtx={() => null} width={1280} height={720} />
    </Provider>,
  )
}

describe('a battle, beat by beat', () => {
  it('draws each beat and only that beat', () => {
    vi.useFakeTimers()

    // --- versus (13c): the lockup opens the scene over both fighters, both
    // rooms and both songs, before a note is played
    at(0)
    const versus = screen(beat('versus', 0, BATTLE_VERSUS_MS))
    expect(versus).toContain('logo-singer-battle.png')
    expect(versus).toContain('>VS<')
    expect(versus).toContain('Challenger')
    expect(versus).toContain('Opponent')
    expect(versus).toContain('Dot Matrix')
    expect(versus).toContain('Barf')
    // the song, not the artist: "sings {title}"
    expect(versus).toContain('sings Barracuda')
    expect(versus).toContain('sings Africa')
    expect(versus).not.toContain('Heart')
    // the colour wedges and both fighters in key art rather than a loop
    expect(versus).toContain('wedgeOne')
    expect(versus).toContain('wedgeTwo')
    expect(versus).toContain('fighters/default/belter/views/key.png')
    expect(versus).toContain('fighters/default/crooner/views/key.png')
    // the count has not started yet
    expect(versus).not.toContain('Get ready')

    // --- intro1 (13d): the challenger alone, with the song their opponent
    // chose. Naming the picker is the point of the beat.
    at(BATTLE_VERSUS_MS)
    const intro1 = screen(beat('intro1', BATTLE_VERSUS_MS, BATTLE_INTRO_MS))
    expect(intro1).toContain('On stage next')
    expect(intro1).not.toContain('Singer 1')
    expect(intro1).toContain('Dot Matrix')
    expect(intro1).toContain('Barracuda')
    expect(intro1).toContain('Heart')
    expect(intro1).toContain('Battle · round 1')
    expect(intro1).toContain('Picked by Barf')
    expect(intro1).toContain('fighters/default/belter/dance-sheet.png')
    expect(intro1).toContain('assets/arcade/logo.svg')
    expect(intro1).toContain('Loveshack')
    expect(intro1).not.toContain('Africa')

    // --- sing1 (13e): the fighter on the left, the video in the panel beside
    at(10_000)
    const sing1 = screen(beat('sing1', 10_000, BATTLE_SING_MS))
    expect(sing1).toContain('Dot Matrix')
    expect(sing1).toContain('Battle · round 1 of 2')
    expect(sing1).toContain('Barracuda · picked by Barf')
    expect(sing1).toContain('fighters/default/belter/sing-sheet.png')
    // a clock, not a score: two minutes opens at 2:00, not at 120
    expect(sing1).toContain('2:00')
    // the panel and the hole in the plate behind it are on the same side, and
    // it is the side the singer is not standing on
    expect(sing1).toContain('panelOne')
    expect(sing1).toContain('holeOne')
    expect(sing1).toContain('singSpriteOne')
    // and the stage ground is off, or the karaoke player never reaches the room
    expect(sing1).toContain('stageOpen')
    expect(sing1).not.toContain('Africa')
    // the video is clean: no badge on it and no scanlines over it
    expect(sing1).not.toContain('Live')
    expect(sing1).not.toContain('scanlines')

    // --- intro2 (13f): the other fighter, the other colour, the other song
    at(130_000)
    const intro2 = screen(beat('intro2', 130_000, BATTLE_INTRO_MS))
    expect(intro2).toContain('On stage next')
    expect(intro2).toContain('Barf')
    expect(intro2).toContain('Africa')
    expect(intro2).toContain('Battle · round 2')
    expect(intro2).toContain('Picked by Dot Matrix')
    expect(intro2).toContain('fighters/default/crooner/dance-sheet.png')

    // --- sing2 (13g): the whole beat mirrors, panel and hole with it
    at(135_000)
    const sing2 = screen(beat('sing2', 135_000, BATTLE_SING_MS))
    expect(sing2).toContain('Barf')
    // the picker's name as they wrote it, never lowercased
    expect(sing2).toContain('Africa · picked by Dot Matrix')
    expect(sing2).toContain('fighters/default/crooner/sing-sheet.png')
    expect(sing2).toContain('panelTwo')
    expect(sing2).toContain('holeTwo')
    expect(sing2).toContain('singSpriteTwo')
    expect(sing2).not.toContain('Barracuda')

    // --- judge, crowd path: the ask, five seconds, and nothing to vote on
    at(255_000)
    const judge = screen(beat('judge', 255_000, BATTLE_JUDGE_MS))
    expect(judge).toContain('Who wins?')
    expect(judge).toContain('The room decides')
    expect(judge).toContain('Get loud for the one you liked')
    // Both fighters are on stage and neither is named: the room has just heard
    // them and the question is about the singing, not about reading a caption.
    expect(judge).toContain('fighters/default/belter/views/key.png')
    expect(judge).toContain('fighters/default/crooner/views/key.png')
    expect(judge).not.toContain('Dot Matrix')
    expect(judge).not.toContain('voteFoot')

    // --- meter1: the room is heard for the challenger
    at(260_000)
    const meter1 = screen(beat('meter1', 260_000, BATTLE_METER_MS))
    expect(meter1).toContain('Cheer for')
    expect(meter1).toContain('Dot Matrix')
    expect(meter1).toContain('Onboard mic listening')
    expect(meter1).toContain('role="meter"')
    expect(meter1).toContain('fighters/default/belter/dance-sheet.png')

    // --- meter2: and for the opponent
    at(275_000)
    const meter2 = screen(beat('meter2', 275_000, BATTLE_METER_MS))
    expect(meter2).toContain('Barf')
    expect(meter2).toContain('role="meter"')
    expect(meter2).toContain('fighters/default/crooner/dance-sheet.png')

    // --- winner (13i): the verdict and both grades
    at(290_000)
    const winner = screen(beat('winner', 290_000, BATTLE_WINNER_MS, {
      challengerScore: 41,
      opponentScore: 88,
    }))
    expect(winner).toContain('Barf')
    expect(winner).toContain('alt="Wins"')
    expect(winner).toContain('alt="Game over"')
    expect(winner).toContain('>88<')
    expect(winner).toContain('>41<')
    expect(winner).not.toContain('By 47')
    // Both fighters are on the verdict, and which set each plays is the whole
    // reading of it: side 2 won, so the crooner celebrates and the belter is
    // on the floor. Swapping these draws the loser taking a bow.
    expect(winner).toContain('fighters/default/crooner/victory-sheet.png')
    expect(winner).toContain('fighters/default/belter/ko-sheet.png')
  })

  it('counts the room in over the versus: Get ready 05 to 01, then BEGIN', () => {
    vi.useFakeTimers()

    const versus = beat('versus', 0, BATTLE_VERSUS_MS)
    const watch = (ms: number) => {
      at(ms)
      return screen(versus)
    }

    watch(0)
    expect(watch(3_200)).toContain('Get ready')
    expect(watch(3_200)).toContain('>05<')
    expect(watch(3_200)).not.toContain('countdownHot')
    // the last three in red
    expect(watch(5_300)).toContain('>03<')
    expect(watch(5_300)).toContain('countdownHot')
    expect(watch(7_300)).toContain('>01<')
    expect(watch(8_300)).toContain('alt="Begin"')
    expect(watch(8_300)).not.toContain('Get ready')
  })

  /**
   * A ko ends with the fighter on the floor, so it plays once and stops rather
   * than cycling — a looped ko stands the loser back up to be knocked down
   * again every two seconds, in front of the room. The victory is the other
   * way round: 13i loops it for as long as the verdict is up.
   */
  describe('the verdict sprites', () => {
    /** One payload, watched as time passes over it — which is the only way to
     *  drive this. serverNow pins its correction to the first render of a
     *  given turn object, so a fresh one always reads as just-sent and the
     *  animation never leaves frame 0. */
    const watch = () => {
      const turn = beat('winner', 290_000, BATTLE_WINNER_MS, {
        challengerScore: 41,
        opponentScore: 88,
      })

      return (intoBeatMs: number) => {
        at(290_000 + intoBeatMs)

        return screen(turn)
      }
    }

    /** Where one sheet is cut on this frame. */
    const cellOf = (markup: string, set: 'ko' | 'victory') =>
      markup.match(new RegExp(`${set}-sheet\\.png[^"]*background-position:([^;"]+)`))?.[1]

    it('starts the knockdown on its first frame', () => {
      vi.useFakeTimers()
      at(290_000)

      expect(cellOf(watch()(0), 'ko')).toBe('0% 0%')
    })

    it('walks the knockdown and then holds its last frame', () => {
      vi.useFakeTimers()
      at(290_000)
      const verdict = watch()

      // 8fps, sixteen frames in two rows, 600ms in: the last is reached at
      // 2.475s and has to still be the one on screen for the rest of the beat.
      expect(cellOf(verdict(0), 'ko')).toBe('0% 0%')
      expect(cellOf(verdict(975), 'ko')).toBe('42.857142857142854% 0%')
      expect(cellOf(verdict(1_600), 'ko')).toBe('0% 100%')
      expect(cellOf(verdict(2_475), 'ko')).toBe('100% 100%')
      expect(cellOf(verdict(14_000), 'ko')).toBe('100% 100%')
    })

    it('keeps the victory looping for the whole beat', () => {
      vi.useFakeTimers()
      at(290_000)
      const verdict = watch()

      // one full turn of the sheet, late in the beat, still walks every frame
      const late = new Set(Array.from({ length: 16 }, (_, i) => cellOf(verdict(12_000 + i * 125), 'victory')))
      expect(late.size).toBe(16)
    })

    it('knocks both fighters down on a draw and stands neither up', () => {
      vi.useFakeTimers()
      at(290_000)

      const drawn = screen(beat('winner', 290_000, BATTLE_WINNER_MS, {
        challengerScore: 50,
        opponentScore: 50,
      }))

      expect(drawn).toContain('Draw')
      expect(drawn).toContain('Nobody wins')
      expect(drawn).toContain('fighters/default/belter/ko-sheet.png')
      expect(drawn).toContain('fighters/default/crooner/ko-sheet.png')
      expect(drawn).not.toContain('victory.png')
    })
  })

  it('prints the counts raw, with what each fighter took home', () => {
    vi.useFakeTimers()
    at(0)

    const winner = screen(beat('winner', 0, BATTLE_WINNER_MS, {
      judging: 'ballot',
      challengerScore: 7,
      opponentScore: 5,
    }))

    expect(winner).toContain('7 votes')
    expect(winner).toContain('5 votes')
    expect(winner).toContain('+1000')
    expect(winner).toContain('+250')
  })

  it('rolls tonight\'s totals up from before the fight', () => {
    vi.useFakeTimers()
    at(0)

    // The fight is paid as the verdict goes up (D9), so the board already
    // holds the new totals; the count starts from the award's worth below.
    const winner = screen(
      beat('winner', 0, BATTLE_WINNER_MS, { challengerScore: 7, opponentScore: 5 }),
      7,
      [{ userId: 1, points: 3400 }, { userId: 2, points: 1250 }],
    )

    expect(winner).toContain('Tonight')
    expect(winner).toContain('>2400<')
    expect(winner).toContain('>1000<')
  })

  it('calls it a draw rather than picking one, when both were heard the same', () => {
    vi.useFakeTimers()
    at(290_000)

    const drawn = screen(beat('winner', 290_000, BATTLE_WINNER_MS, {
      challengerScore: 61,
      opponentScore: 61,
    }))

    expect(drawn).toContain('Draw')
    expect(drawn).toContain('Nobody wins')
    expect(drawn).not.toContain('alt="Wins"')
    // both took part, and both are paid for it
    expect(drawn.split('+250').length - 1).toBe(2)
  })
})

describe('the vote (13h)', () => {
  /**
   * There is no ballot beat: asking the room and counting the room are one
   * screen. The same `judge` phase runs for thirty seconds instead of five, and
   * the split fills as the room votes (U-13).
   */
  it('asks the room to vote on its phones, and fills the split as it does', () => {
    vi.useFakeTimers()
    at(255_000)

    const ballot = screen(beat('judge', 255_000, BATTLE_JUDGE_BALLOT_MS, {
      judging: 'ballot',
      challengerVotes: 6,
      opponentVotes: 3,
      ballotsIn: 9,
      ballotsOf: 12,
    }))

    expect(ballot).toContain('VOTE NOW')
    expect(ballot).toContain('on your phone')
    expect(ballot).toContain('0:30')
    expect(ballot).toContain('>P1<')
    expect(ballot).toContain('>P2<')
    expect(ballot).toContain('Dot Matrix')
    expect(ballot).toContain('Barf')
    expect(ballot).toContain('>6<')
    expect(ballot).toContain('>3<')
    // each side's share of the room, from its own end of the bar
    expect(ballot).toContain('width:50%')
    expect(ballot).toContain('width:25%')
    expect(ballot).toContain('assets/arcade/logo.svg')
    expect(ballot).toContain('Loveshack')
    expect(ballot).not.toContain('Get loud')
  })

  it('stands the two fighters facing out, toward the room', () => {
    vi.useFakeTimers()
    at(255_000)

    const ballot = screen(beat('judge', 255_000, BATTLE_JUDGE_BALLOT_MS, { judging: 'ballot' }))
    const flipped = ballot.match(/class="sprite(?: [^"]*)?"/g) ?? []

    // side 1 is the one that would flip to face in; here only side 2 does
    expect(flipped).toHaveLength(2)
    expect(flipped[0]).not.toContain('spriteFlip')
    expect(flipped[1]).toContain('spriteFlip')
  })
})

describe('a player that cannot hear the room', () => {
  it('never draws a crowd meter, and says why the verdict is a draw', () => {
    vi.useFakeTimers()

    // The eight beats such a battle actually has: the server skips meter1 and
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
    expect(verdict).toContain('No microphone on this player')
  })
})

describe('a beat that is not ours', () => {
  it('holds the stage rather than drawing somebody else\'s battle', () => {
    vi.useFakeTimers()
    at(0)

    // the last beat of the previous row, still in the store as this one starts
    const stale = screen(beat('winner', 0, BATTLE_WINNER_MS), 9)

    expect(stale).toContain('Getting ready')
    expect(stale).not.toContain('Dot Matrix')
  })

  it('holds the stage while a beat that has run out waits for its successor', () => {
    vi.useFakeTimers()

    // first sight caches the clock correction, exactly as a real arrival does
    const judge = beat('judge', 0, BATTLE_JUDGE_MS)
    at(0)
    expect(screen(judge)).toContain('Who wins?')

    // the beat's deadline passes and the next one is still on the wire. This
    // row has been seen, so the wait reads as a stall rather than as a start.
    at(BATTLE_JUDGE_MS + 1)
    const gap = screen(judge)
    expect(gap).toContain('Hold on')
    expect(gap).not.toContain('Who wins?')
  })

  /**
   * Each round stands in its own singer's room, and the verdict in the
   * winner's (U-10b). Drawn from the ids on the beat itself rather than from
   * the fighter listing, which is `{}` until its fetch lands.
   */
  it('stands each round in its singer\'s room, and the verdict in the winner\'s', () => {
    vi.useFakeTimers()

    const location = (markup: string) => markup.match(/[\w/-]+\/location\.png/)?.[0]
    const ids = { challengerSingerId: 'halloween/hex', opponentSingerId: 'p2' }

    at(TO_SING1)
    const sing1 = screen(beat('sing1', TO_SING1, BATTLE_SING_MS, ids))

    at(TO_SING2)
    const sing2 = screen(beat('sing2', TO_SING2, BATTLE_SING_MS, ids))

    at(TO_SING2 + BATTLE_SING_MS)
    const won = screen(beat('winner', TO_SING2 + BATTLE_SING_MS, BATTLE_WINNER_MS, {
      ...ids,
      challengerScore: 3,
      opponentScore: 9,
    }))

    expect(location(sing1)).toBe('assets/battle/fighters/halloween/hex/location.png')
    expect(location(sing2)).toBe('assets/battle/fighters/default/crooner/location.png')
    expect(location(won)).toBe('assets/battle/fighters/default/crooner/location.png')
  })

  it('falls back to the dive bar for a challenger who ships no room of their own', () => {
    vi.useFakeTimers()
    at(TO_SING1)

    // Most fighters have no location.png, so the 404 is the ordinary path
    // rather than the error one. Mounted rather than rendered to a string,
    // because what is being tested is the browser's onError firing — the one
    // thing a static render cannot do.
    const { container } = mount(beat('sing1', TO_SING1, BATTLE_SING_MS, {
      challengerSingerId: 'halloween/hex',
    }))
    const plate = container.querySelector('.plate') as HTMLImageElement

    expect(plate.getAttribute('src')).toBe('assets/battle/fighters/halloween/hex/location.png')

    fireEvent.error(plate)

    expect(container.querySelector('.plate')?.getAttribute('src'))
      .toBe('assets/battle/stage-dive-bar.png')
    cleanup()
  })

  it('holds the stage when there is no battle at all yet', () => {
    vi.useFakeTimers()
    at(0)

    expect(screen(null)).toContain('Getting ready')
  })
})
