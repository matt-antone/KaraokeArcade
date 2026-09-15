// @vitest-environment happy-dom
import React from 'react'
import { Provider } from 'react-redux'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { battleTurn } from 'lib/battleFixtures'
import {
  BATTLE_INTRO_MS,
  BATTLE_JUDGE_BALLOT_MS,
  BATTLE_JUDGE_MS,
  BATTLE_LOGO_MS,
  BATTLE_METER_MS,
  BATTLE_SING_MS,
  BATTLE_VERSUS_MS,
  BATTLE_WINNER_MS,
} from 'shared/types'
import type { BattlePhase, BattleTurn } from 'shared/types'
import PlayerBattle from './PlayerBattle'
import type { BattleUpNext } from './battleBeats'

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

const beat = (phase: BattlePhase, from: number, ms: number, over: Partial<BattleTurn> = {}): BattleTurn =>
  battleTurn({ phase, sentAt: SERVER_T0 + from, endsAt: SERVER_T0 + from + ms, ...over })

/** Just enough store for useBattleStage and useCrowdMic's dispatch. The state
 *  object is kept whole so useSelector's identity check does not spin. */
const screen = (turn: BattleTurn | null, queueId = 7, upNext: BattleUpNext | null = null) => {
  const state = { battle: { turn } }
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
        upNext={upNext}
        width={1280}
        height={720}
      />
    </Provider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('a battle, beat by beat', () => {
  it('draws each beat and only that beat', () => {
    vi.useFakeTimers()

    // --- logo: the title card, and nothing else. The assertions that matter
    // here are the absences: this beat is the only one in the sequence with no
    // fighter, no name and no song on it, and the moment one of those leaks in
    // it has stopped being a title card and become a second versus screen.
    at(-BATTLE_LOGO_MS)
    const logo = screen(beat('logo', -BATTLE_LOGO_MS, BATTLE_LOGO_MS))
    expect(logo).toContain('logo-singer-battle.png')
    expect(logo).toContain('titleCard')
    expect(logo).not.toContain('Dot Matrix')
    expect(logo).not.toContain('Barf')
    expect(logo).not.toContain('Barracuda')
    expect(logo).not.toContain('Africa')
    expect(logo).not.toContain('fighters/')
    // and it is a beat, not the holding card the player draws while a payload
    // is in flight — that one covers the plate with a flat black and says a
    // word; this one is the lockup over the room the fight is in
    expect(logo).not.toContain('holding')
    expect(logo).toContain('plate')

    // --- versus: both fighters, both songs, before a note is played
    at(0)
    const versus = screen(beat('versus', 0, BATTLE_VERSUS_MS))
    expect(versus).toContain('VS')
    expect(versus).toContain('Dot Matrix')
    expect(versus).toContain('Barf')
    expect(versus).toContain('Barracuda')
    expect(versus).toContain('Africa')
    // the colour wedges and both fighters in key art rather than a loop
    expect(versus).toContain('wedgeOne')
    expect(versus).toContain('wedgeTwo')
    expect(versus).toContain('fighters/belter/key.png')
    expect(versus).toContain('fighters/crooner/key.png')

    // --- intro1: the challenger alone, with the song their opponent chose.
    // Naming the picker is the point of the beat, so unlike the rest of this
    // walk the other fighter's name is expected here.
    at(BATTLE_VERSUS_MS)
    const intro1 = screen(beat('intro1', BATTLE_VERSUS_MS, BATTLE_INTRO_MS))
    expect(intro1).toContain('Singer 1')
    expect(intro1).toContain('Dot Matrix')
    expect(intro1).toContain('Barracuda')
    expect(intro1).toContain('Picked by Barf')
    expect(intro1).toContain('fighters/belter/dance.png')
    expect(intro1).not.toContain('Africa')

    // --- sing1: the fighter keeps the left third, the video takes the rest
    at(10_000)
    const sing1 = screen(beat('sing1', 10_000, BATTLE_SING_MS))
    expect(sing1).toContain('Dot Matrix')
    expect(sing1).toContain('Barracuda')
    expect(sing1).toContain('fighters/belter/sing.png')
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

    // --- intro2: the other fighter, the other colour, the other song
    at(130_000)
    const intro2 = screen(beat('intro2', 130_000, BATTLE_INTRO_MS))
    expect(intro2).toContain('Singer 2')
    expect(intro2).toContain('Barf')
    expect(intro2).toContain('Africa')
    expect(intro2).toContain('Picked by Dot Matrix')
    expect(intro2).toContain('fighters/crooner/dance.png')

    // --- sing2: the whole beat mirrors, panel and hole with it
    at(135_000)
    const sing2 = screen(beat('sing2', 135_000, BATTLE_SING_MS))
    expect(sing2).toContain('Barf')
    expect(sing2).toContain('Africa')
    expect(sing2).toContain('fighters/crooner/sing.png')
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
    expect(judge).toContain('fighters/belter/key.png')
    expect(judge).toContain('fighters/crooner/key.png')
    expect(judge).not.toContain('Dot Matrix')
    expect(judge).not.toContain('ballotCard')

    // --- meter1: the room is heard for the challenger
    at(260_000)
    const meter1 = screen(beat('meter1', 260_000, BATTLE_METER_MS))
    expect(meter1).toContain('Cheer for')
    expect(meter1).toContain('Dot Matrix')
    expect(meter1).toContain('Onboard mic listening')
    expect(meter1).toContain('role="meter"')
    expect(meter1).toContain('fighters/belter/dance.png')

    // --- meter2: and for the opponent
    at(275_000)
    const meter2 = screen(beat('meter2', 275_000, BATTLE_METER_MS))
    expect(meter2).toContain('Barf')
    expect(meter2).toContain('role="meter"')
    expect(meter2).toContain('fighters/crooner/dance.png')

    // --- winner: the verdict, both grades, and the margin between them
    at(290_000)
    const winner = screen(beat('winner', 290_000, BATTLE_WINNER_MS, {
      challengerScore: 41,
      opponentScore: 88,
    }))
    expect(winner).toContain('Barf')
    expect(winner).toContain('Takes it')
    expect(winner).toContain('>88<')
    expect(winner).toContain('>41<')
    expect(winner).toContain('By 47')
    // Both fighters are on the verdict, and which set each plays is the whole
    // reading of it: side 2 won, so the crooner celebrates and the belter is
    // on the floor. Swapping these draws the loser taking a bow.
    expect(winner).toContain('fighters/crooner/victory.png')
    expect(winner).toContain('fighters/belter/ko.png')
  })

  /**
   * A ko ends with the fighter on the floor and a victory with their arm up.
   * Neither drawing returns to where it started, so both play once and stop
   * rather than cycling — a looped ko stands the loser back up to be knocked
   * down again every two seconds, in front of the room.
   */
  describe('the verdict one-shots', () => {
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

    it('starts both fighters on their first frame', () => {
      vi.useFakeTimers()
      at(290_000)

      expect(watch()(0)).toContain('background-position:0% 0%')
    })

    it('walks the animation and then holds its last frame', () => {
      vi.useFakeTimers()
      at(290_000)
      const verdict = watch()

      // 4fps, eight frames: the last is reached at 1.75s and has to still be
      // the one on screen for the rest of a fifteen-second beat.
      expect(verdict(0)).toContain('background-position:0% 0%')
      expect(verdict(750)).toContain('background-position:42.857142857142854% 0%')
      expect(verdict(1_750)).toContain('background-position:100% 0%')
      expect(verdict(14_000)).toContain('background-position:100% 0%')
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
      expect(drawn).toContain('fighters/belter/ko.png')
      expect(drawn).toContain('fighters/crooner/ko.png')
      expect(drawn).not.toContain('victory.png')
    })
  })

  it('zero-pads a single-digit grade rather than letting the band shift', () => {
    vi.useFakeTimers()
    at(0)

    const winner = screen(beat('winner', 0, BATTLE_WINNER_MS, {
      challengerScore: 9,
      opponentScore: 12,
    }))

    expect(winner).toContain('>09<')
    expect(winner).toContain('>12<')
  })

  /* The handover the room would otherwise have lost.
   *
   * The page that names the next singer is stood down before a battle, because
   * it can only name one of two fighters — so the verdict beat carries it, and
   * nobody waits through a second countdown to find out whose turn it is. It
   * belongs to that beat alone: a fight still being fought must not be
   * advertising what comes after it. */
  describe('the handover on the verdict beat', () => {
    const upNext: BattleUpNext = {
      singer: 'Lone Starr',
      songArtist: 'Toto',
      songTitle: 'Rosanna',
    }

    it('names the next singer and their song on the verdict', () => {
      vi.useFakeTimers()
      at(290_000)

      const winner = screen(beat('winner', 290_000, BATTLE_WINNER_MS), 7, upNext)

      expect(winner).toContain('Up next')
      expect(winner).toContain('Lone Starr')
      expect(winner).toContain('Rosanna')
      expect(winner).toContain('Toto')
    })

    it('says nothing when there is nobody after the fight', () => {
      vi.useFakeTimers()
      at(290_000)

      expect(screen(beat('winner', 290_000, BATTLE_WINNER_MS), 7, null))
        .not.toContain('Up next')
    })

    it('stays off every other beat', () => {
      vi.useFakeTimers()

      at(0)
      expect(screen(beat('versus', 0, BATTLE_VERSUS_MS), 7, upNext)).not.toContain('Lone Starr')

      at(30_000)
      expect(screen(beat('sing1', 30_000, BATTLE_SING_MS), 7, upNext)).not.toContain('Lone Starr')

      at(280_000)
      expect(screen(beat('judge', 280_000, BATTLE_JUDGE_MS), 7, upNext)).not.toContain('Lone Starr')
    })
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
    expect(drawn).toContain('Dead heat')
    expect(drawn).not.toContain('Takes it')
  })
})

describe('the silent ballot', () => {
  /**
   * There is no ballot beat: asking the room and counting the room are one
   * screen, because a vote has nothing to look at while it happens. The same
   * `judge` phase runs for thirty seconds instead of five and grows the two
   * vote cards.
   */
  it('holds the vote on the judge beat, and never shows the room the split', () => {
    vi.useFakeTimers()
    at(255_000)

    const ballot = screen(beat('judge', 255_000, BATTLE_JUDGE_BALLOT_MS, {
      judging: 'ballot',
      ballotsIn: 7,
      ballotsOf: 18,
    }))

    expect(ballot).toContain('Who wins?')
    expect(ballot).toContain('Silent ballot')
    expect(ballot).toContain('Press 1')
    expect(ballot).toContain('Press 2')
    expect(ballot).toContain('Dot Matrix')
    expect(ballot).toContain('Barf')
    expect(ballot).toContain('One vote each')
    expect(ballot).toContain('Sealed until time')
    expect(ballot).toContain('7 of 18 in')
    // thirty seconds, and the crowd path's call to action is not on this one
    expect(ballot).toContain('Ballot closes in 30s')
    expect(ballot).not.toContain('Get loud')

    // One cell per phone, seven of them filled, and the filled ones carry no
    // mark of which way they went. The count is the point and the split is the
    // danger; see BallotRow.
    expect(ballot.split('ballotCell').length - 1).toBe(18 + 7)
    expect(ballot).not.toContain('winScore')
  })

  it('drops the row and the count in a room with nobody left to poll', () => {
    vi.useFakeTimers()
    at(255_000)

    // a battle between the only two people in the venue: 0 OF 0 IN reads as a
    // fault in the count rather than as an empty room
    const ballot = screen(beat('judge', 255_000, BATTLE_JUDGE_BALLOT_MS, {
      judging: 'ballot',
      ballotsIn: 0,
      ballotsOf: 0,
    }))

    expect(ballot).toContain('Sealed until time')
    expect(ballot).not.toContain('ballotCell')
    expect(ballot).not.toContain('of 0 in')
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

  it('holds the stage when there is no battle at all yet', () => {
    vi.useFakeTimers()
    at(0)

    expect(screen(null)).toContain('Getting ready')
  })
})
