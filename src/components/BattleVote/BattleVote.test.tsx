// @vitest-environment happy-dom
import React from 'react'
import { Provider } from 'react-redux'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { battleTurn } from 'lib/battleFixtures'
import { BATTLE_JUDGE_BALLOT_MS, BATTLE_SING_MS, BATTLE_WINNER_MS } from 'shared/types'
import type { BattlePhase, BattleSide, BattleSinger, BattleTurn } from 'shared/types'
import BattleVote from './BattleVote'

/**
 * The room's phone during a battle, and the five things it can be saying.
 *
 * The ways this can be wrong are all silent. Keys in front of a fighter, who
 * would then be voting for themselves where nobody can see it. A screen that
 * outlives its beat, which would take a vote nothing counts. A phone drawing a
 * ballot for a fight the room is judging by microphone, where there is nothing
 * on the other end of the tap. And — the one the whole design is built around
 * — a ballot row that says which way the room is leaning while it is still
 * being asked.
 *
 * Static render for the same reasons PlayerBattle's tests use it: no effects
 * run, so the alert cue and its AudioContext stay out of a test that has
 * neither.
 */

const SERVER_T0 = 1_700_000_000_000
/** A phone's clock is never the server's; every beat below is placed on the
 *  server's timeline and read on this one. */
const SKEW = 37_000

const at = (serverMs: number) => vi.setSystemTime(SERVER_T0 + serverMs + SKEW)

const beat = (phase: BattlePhase, ms: number, over: Partial<BattleTurn> = {}): BattleTurn =>
  battleTurn({ phase, judging: 'ballot', sentAt: SERVER_T0, endsAt: SERVER_T0 + ms, ...over })

/** Dot Matrix is the challenger, Barf the opponent, Carol is just watching. */
const CAROL = 3

const screen = (turn: BattleTurn | null, userId = CAROL, vote: { queueId: number, side: BattleSide } | null = null) => {
  const state = { battle: { turn, vote, singers: [] as BattleSinger[] }, user: { userId, name: 'CAROL' } }
  const store = {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: () => {},
  } as never

  return renderToStaticMarkup(
    <Provider store={store}>
      <BattleVote />
    </Provider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('the room votes', () => {
  it('waits with both fighters, saying which one the room is listening to', () => {
    vi.useFakeTimers()
    at(0)

    const phone = screen(beat('sing1', BATTLE_SING_MS))

    expect(phone).toContain('IN PROGRESS')
    expect(phone).toContain('Dot Matrix')
    expect(phone).toContain('Barf')
    expect(phone).toContain('ON STAGE')
    expect(phone).toContain('UP NEXT')
    // nothing to press until the judge beat: a key here takes a vote against a
    // fighter the room has not heard yet
    expect(phone).not.toContain('<button')
  })

  it('offers both fighters on the judge beat, by name and by what they sang', () => {
    vi.useFakeTimers()
    at(0)

    const phone = screen(beat('judge', BATTLE_JUDGE_BALLOT_MS))

    expect(phone).toContain('WHO WINS?')
    expect(phone).toContain('Dot Matrix')
    expect(phone).toContain('Barf')
    // each fighter under the song they actually sang, which is the one the
    // other one picked for them
    expect(phone).toContain('Barracuda')
    expect(phone).toContain('Africa')
  })

  it('seals the vote it took, and never says which way the room is going', () => {
    vi.useFakeTimers()
    at(0)

    const phone = screen(beat('judge', BATTLE_JUDGE_BALLOT_MS), CAROL, { queueId: 7, side: 2 })

    expect(phone).toContain('VOTE IN')
    expect(phone).toContain('YOU VOTED')
    expect(phone).toContain('Barf')
    expect(phone).toContain('YOU CANNOT CHANGE IT')
    // the ballot is gone with the vote — there is no second tap, and no key
    // left to tell anyone this phone changed its mind
    expect(phone).not.toContain('WHO WINS?')
    expect(phone).not.toContain('<button')
  })

  it('draws the room the server counted, not the room this phone has seen', () => {
    vi.useFakeTimers()
    at(0)

    // Seventeen phones could vote and eleven have. Both numbers come off the
    // turn: a count assembled from what this device happened to fetch would be
    // a different number on every phone in the room.
    const phone = screen(
      beat('judge', BATTLE_JUDGE_BALLOT_MS, { ballotsIn: 11, ballotsOf: 17 }),
      CAROL,
      { queueId: 7, side: 2 },
    )

    expect(phone).toContain('11 OF 17 IN')
  })

  it('lights a cell per vote and never says which way any of them went', () => {
    vi.useFakeTimers()
    at(0)

    const phone = screen(
      beat('judge', BATTLE_JUDGE_BALLOT_MS, { ballotsIn: 4, ballotsOf: 9 }),
      CAROL,
      { queueId: 7, side: 1 },
    )

    // Nine cells, four of them lit, and every lit one carrying exactly the
    // same class as the others. This is the assertion the whole design rests
    // on: the room can see that voting is happening and cannot see the split,
    // because a visible tally makes late voters follow the leader.
    const cells: string[] = phone.match(/class="[^"]*\bcell\b[^"]*"/g) ?? []
    const lit = cells.filter(c => c.includes('cellIn'))

    expect(cells).toHaveLength(9)
    expect(lit).toHaveLength(4)
    expect(new Set(lit).size).toBe(1)
  })

  it('ignores a vote left over from the row before', () => {
    vi.useFakeTimers()
    at(0)

    // the fixture's row is 7; this vote was cast in the battle before it
    const phone = screen(beat('judge', BATTLE_JUDGE_BALLOT_MS), CAROL, { queueId: 6, side: 1 })

    expect(phone).toContain('WHO WINS?')
  })

  it('tells a voter on the verdict whether they called it', () => {
    vi.useFakeTimers()
    at(0)

    const verdict = beat('winner', BATTLE_WINNER_MS, { challengerScore: 8, opponentScore: 5 })

    const backedWinner = screen(verdict, CAROL, { queueId: 7, side: 1 })
    expect(backedWinner).toContain('THE ROOM DECIDED')
    expect(backedWinner).toContain('YOU CALLED IT')
    // zero-padded, so the two plates hold their width as the counts land
    expect(backedWinner).toContain('08')
    expect(backedWinner).toContain('05')

    expect(screen(verdict, CAROL, { queueId: 7, side: 2 })).toContain('YOU BACKED THE OTHER ONE')

    const drawn = beat('winner', BATTLE_WINNER_MS, { challengerScore: 6, opponentScore: 6 })
    expect(screen(drawn, CAROL, { queueId: 7, side: 1 })).toContain('NOBODY TOOK IT')
  })

  it('tells a phone that never voted that the room went without it', () => {
    vi.useFakeTimers()
    at(0)

    const phone = screen(beat('winner', BATTLE_WINNER_MS, { challengerScore: 8, opponentScore: 5 }))

    expect(phone).toContain('BALLOT CLOSED')
    expect(phone).toContain('DID NOT VOTE IN TIME')
    // no recovery and no late vote, so no tally either: the counts belong to
    // the room that earned them
    expect(phone).not.toContain('08')
    expect(phone).not.toContain('Dot Matrix')
  })

  it('gives the two fighters nothing at all', () => {
    vi.useFakeTimers()
    at(0)

    for (const fighterId of [1, 2]) {
      expect(screen(beat('judge', BATTLE_JUDGE_BALLOT_MS), fighterId)).toBe('')
      expect(screen(beat('sing1', BATTLE_SING_MS), fighterId)).toBe('')
    }
  })

  it('stays away from a fight the room is judging by microphone', () => {
    vi.useFakeTimers()
    at(0)

    // crowd judging is graded from the player's own mic and has no phone screen
    expect(screen(beat('judge', BATTLE_JUDGE_BALLOT_MS, { judging: 'crowd' }))).toBe('')
    expect(screen(beat('judge', BATTLE_JUDGE_BALLOT_MS, { judging: 'none' }))).toBe('')
  })

  it('goes with its beat rather than outliving it', () => {
    vi.useFakeTimers()
    at(0)

    expect(screen(null)).toBe('')

    // first sight caches the clock correction, exactly as a real arrival does
    const judge = beat('judge', BATTLE_JUDGE_BALLOT_MS)
    expect(screen(judge)).toContain('WHO WINS?')

    // the beat's deadline passes and the ballot goes with it, rather than
    // taking a vote nothing is left to count
    at(BATTLE_JUDGE_BALLOT_MS + 1)
    expect(screen(judge)).toBe('')
  })
})
