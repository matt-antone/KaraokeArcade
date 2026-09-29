// @vitest-environment happy-dom
import React from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { battleTurn } from 'lib/battleFixtures'
import { BATTLE_JUDGE_BALLOT_MS, BATTLE_SING_MS, BATTLE_WINNER_MS } from 'shared/types'
import type { BattleInvite, BattlePhase, BattleSide, BattleSinger, BattleTurn, LeaderboardEntry } from 'shared/types'
import BattleVote from './BattleVote'

/**
 * Every phone in the room during a battle: 13h/13h2/13j3 for the room, and
 * 13e/13e2/13j/13j2 for the two fighters.
 *
 * The ways this can be wrong are mostly silent. Vote keys in front of a
 * fighter, who would then be voting for themselves. A screen that outlives its
 * beat, which would take a vote nothing counts. A phone drawing a ballot for a
 * fight the room is judging by microphone, where there is nothing on the other
 * end of the tap. And a fighter's phone showing the other fighter's round.
 *
 * Static render: no effects run, so the alert cue and its AudioContext stay
 * out of a test that has neither.
 */

const SERVER_T0 = 1_700_000_000_000
/** A phone's clock is never the server's; every beat below is placed on the
 *  server's timeline and read on this one. */
const SKEW = 37_000

const at = (serverMs: number) => vi.setSystemTime(SERVER_T0 + serverMs + SKEW)

const beat = (phase: BattlePhase, ms: number, over: Partial<BattleTurn> = {}): BattleTurn =>
  battleTurn({ phase, judging: 'ballot', sentAt: SERVER_T0, endsAt: SERVER_T0 + ms, ...over })

/** Dot Matrix (1) is the challenger, Barf (2) the opponent, Carol is watching. */
const CAROL = 3

const screen = (
  turn: BattleTurn | null,
  userId = CAROL,
  vote: { queueId: number, side: BattleSide } | null = null,
  leaderboard: Partial<LeaderboardEntry>[] = [],
) => {
  const state = {
    battle: { turn, vote, singers: [] as BattleSinger[], invite: null as BattleInvite | null },
    user: { userId, name: 'CAROL', roomId: 5, avatarId: 'p3' },
    rooms: { entities: { 5: { name: 'Loveshack' } } },
    points: { leaderboard },
  }
  const store = {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: () => {},
  } as never

  return renderToStaticMarkup(
    <Provider store={store}>
      <MemoryRouter>
        <BattleVote />
      </MemoryRouter>
    </Provider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('the room votes', () => {
  it('leaves the room in the app while the songs are sung', () => {
    vi.useFakeTimers()
    at(0)

    // nothing to press until the judge beat: a key here takes a vote against a
    // fighter the room has not heard yet
    expect(screen(beat('sing1', BATTLE_SING_MS))).toBe('')
    expect(screen(beat('intro2', BATTLE_SING_MS))).toBe('')
  })

  it('offers both fighters on 13h, by name and by what they sang', () => {
    vi.useFakeTimers()
    at(0)

    const phone = screen(beat('judge', BATTLE_JUDGE_BALLOT_MS))

    expect(phone).toContain('Battle')
    expect(phone).toContain('Loveshack')
    expect(phone).toContain('Voting')
    expect(phone).toContain('Who wins?')
    expect(phone).toContain('0:30')
    expect(phone).toContain('One vote · anonymous')
    expect(phone).toContain('Dot Matrix')
    expect(phone).toContain('Barf')
    // each fighter under the song they sang, which the other one picked
    expect(phone).toContain('Barracuda')
    expect(phone).toContain('Africa')
    expect(phone).toContain('>VS<')
    expect(phone).toContain('>Vote P1<')
    expect(phone).toContain('>Vote P2<')
    // both fighters singing in their own rooms
    expect(phone).toContain('fighters/default/belter/sing-sheet.png')
    expect(phone).toContain('fighters/default/crooner/sing-sheet.png')
  })

  it('lights one HP cell per vote as the votes land', () => {
    vi.useFakeTimers()
    at(0)

    // twelve phones can vote; seven have gone red and five green
    const phone = screen(beat('judge', BATTLE_JUDGE_BALLOT_MS, {
      challengerVotes: 7,
      opponentVotes: 5,
      ballotsIn: 12,
      ballotsOf: 12,
    }))

    expect(phone.match(/class="hpCell hpOne"/g)).toHaveLength(7)
    expect(phone.match(/class="hpCell hpTwo"/g)).toHaveLength(5)
    expect(phone.match(/class="hpCell"/g)).toHaveLength(8)

    // and ten at most, however big the room
    const packed = screen(beat('judge', BATTLE_JUDGE_BALLOT_MS, {
      challengerVotes: 14,
      opponentVotes: 3,
      ballotsIn: 17,
      ballotsOf: 30,
    }))
    expect(packed.match(/class="hpCell hpOne"/g)).toHaveLength(10)
  })

  it('locks the vote it took on 13h2', () => {
    vi.useFakeTimers()
    at(0)

    const phone = screen(beat('judge', BATTLE_JUDGE_BALLOT_MS), CAROL, { queueId: 7, side: 2 })

    expect(phone).toContain('Voted')
    expect(phone).toContain('LOCKED')
    expect(phone).toContain('You voted')
    expect(phone).toContain('Barf')
    expect(phone).toContain('Results on the TV · 0:30')
    expect(phone).toContain('>Back to songs<')
    // the ballot is gone with the vote — there is no second tap
    expect(phone).not.toContain('Who wins?')
    expect(phone).not.toContain('Vote P1')
  })

  it('ignores a vote left over from the row before', () => {
    vi.useFakeTimers()
    at(0)

    // the fixture's row is 7; this vote was cast in the battle before it
    const phone = screen(beat('judge', BATTLE_JUDGE_BALLOT_MS), CAROL, { queueId: 6, side: 1 })

    expect(phone).toContain('Who wins?')
  })

  it('shows a voter the winner, the counts, and whether they called it', () => {
    vi.useFakeTimers()
    at(0)

    const verdict = beat('winner', BATTLE_WINNER_MS, { challengerScore: 7, opponentScore: 5 })

    const backedWinner = screen(verdict, CAROL, { queueId: 7, side: 1 })
    expect(backedWinner).toContain('Result')
    expect(backedWinner).toContain('WINS')
    expect(backedWinner).toContain('Your vote')
    expect(backedWinner).toContain('Dot Matrix ✓')
    // raw counts, not zero-padded
    expect(backedWinner).toContain('>7<')
    expect(backedWinner).toContain('>5<')
    // the winner standing in their own room
    expect(backedWinner).toContain('fighters/default/belter/location.png')
    expect(backedWinner).toContain('fighters/default/belter/views/key.png')

    expect(screen(verdict, CAROL, { queueId: 7, side: 2 })).not.toContain('✓')

    const drawn = beat('winner', BATTLE_WINNER_MS, { challengerScore: 6, opponentScore: 6 })
    expect(screen(drawn, CAROL, { queueId: 7, side: 1 })).toContain('nobody took it')
  })

  it('shows a phone that never voted the verdict, without a vote to report', () => {
    vi.useFakeTimers()
    at(0)

    const phone = screen(beat('winner', BATTLE_WINNER_MS, { challengerScore: 8, opponentScore: 5 }))

    expect(phone).toContain('WINS')
    expect(phone).toContain('Dot Matrix')
    expect(phone).not.toContain('Your vote')
  })

  it('asks no vote of a fight the room is judging by microphone, but shows its verdict', () => {
    vi.useFakeTimers()
    at(0)

    // crowd judging is graded from the player's own mic and asks no phone
    expect(screen(beat('judge', BATTLE_JUDGE_BALLOT_MS, { judging: 'crowd' }))).toBe('')
    expect(screen(beat('judge', BATTLE_JUDGE_BALLOT_MS, { judging: 'none' }))).toBe('')

    // the verdict is 13j3 all the same, drawn without a vote to report
    const verdict = screen(beat('winner', BATTLE_WINNER_MS, { judging: 'crowd', challengerScore: 82, opponentScore: 61 }))
    expect(verdict).toContain('WINS')
    expect(verdict).toContain('Dot Matrix')
    expect(verdict).not.toContain('Your vote')
  })

  it('goes with its beat rather than outliving it', () => {
    vi.useFakeTimers()
    at(0)

    expect(screen(null)).toBe('')

    // first sight caches the clock correction, exactly as a real arrival does
    const judge = beat('judge', BATTLE_JUDGE_BALLOT_MS)
    expect(screen(judge)).toContain('Who wins?')

    // the beat's deadline passes and the ballot goes with it, rather than
    // taking a vote nothing is left to count
    at(BATTLE_JUDGE_BALLOT_MS + 1)
    expect(screen(judge)).toBe('')
  })
})

describe('the fighters\' phones', () => {
  it('never offers a fighter a vote', () => {
    vi.useFakeTimers()
    at(0)

    for (const fighterId of [1, 2]) {
      expect(screen(beat('judge', BATTLE_JUDGE_BALLOT_MS), fighterId)).not.toContain('Vote P')
    }
  })

  it('puts the challenger on 13e for their own round, and nothing on the other', () => {
    vi.useFakeTimers()
    at(0)

    const mine = screen(beat('sing1', BATTLE_SING_MS), 1)
    expect(mine).toContain('Round 1')
    expect(mine).toContain('P1 · You')
    expect(mine).toContain('YOU&#x27;RE ON')
    expect(mine).toContain('Barracuda')
    expect(mine).toContain('Heart')
    expect(mine).toContain('Sing to the room · watch the TV')
    // the whole cut left: 2:00 and ten lit cells
    expect(mine).toContain('2:00')
    expect(mine.match(/class="hpCell hpOne"/g)).toHaveLength(10)
    expect(mine).toContain('fighters/default/belter/sing-sheet.png')

    expect(screen(beat('sing2', BATTLE_SING_MS), 1)).toBe('')
  })

  it('puts the opponent on 13e2 for theirs, with the song running down', () => {
    vi.useFakeTimers()
    at(0)

    const turn = beat('sing2', BATTLE_SING_MS)
    expect(screen(turn, 2)).toContain('P2 · You')

    // a minute in: half the cut left, five cells
    at(60_000)
    const later = screen(turn, 2)
    expect(later).toContain('Round 2')
    expect(later).toContain('1:00')
    expect(later.match(/class="hpCell hpTwo"/g)).toHaveLength(5)
  })

  it('tells the winner YOU WIN and what it was worth', () => {
    vi.useFakeTimers()
    at(0)

    const phone = screen(
      beat('winner', BATTLE_WINNER_MS, { challengerScore: 7, opponentScore: 5 }),
      1,
      null,
      [{ userId: 3, points: 9999 }, { userId: 1, points: 3400 }],
    )

    expect(phone).toContain('YOU WIN')
    expect(phone).toContain('vs Barf')
    expect(phone).toContain('>You<')
    expect(phone).toContain('Battle win')
    expect(phone).toContain('+1000')
    expect(phone).toContain('Tonight')
    expect(phone).toContain('>3400<')
    expect(phone).toContain('>Back to songs<')
  })

  it('knocks the loser out, and offers a rematch', () => {
    vi.useFakeTimers()
    at(0)

    const phone = screen(beat('winner', BATTLE_WINNER_MS, { challengerScore: 7, opponentScore: 5 }), 2)

    expect(phone).toContain('K.O.')
    expect(phone).toContain('Dot Matrix wins')
    expect(phone).toContain('Battle played')
    expect(phone).toContain('+250')
    expect(phone).toContain('>Rematch<')
    // the loser in their own room
    expect(phone).toContain('fighters/default/crooner/views/key.png')
  })

  it('gives both fighters the played screen on a draw', () => {
    vi.useFakeTimers()
    at(0)

    for (const fighterId of [1, 2]) {
      const phone = screen(beat('winner', BATTLE_WINNER_MS, { challengerScore: 6, opponentScore: 6 }), fighterId)

      expect(phone).toContain('nobody took it')
      expect(phone).toContain('+250')
      expect(phone).not.toContain('YOU WIN')
    }
  })
})
