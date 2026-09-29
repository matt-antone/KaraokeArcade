import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, it, expect } from 'vitest'
import TriviaDialog from './TriviaDialog'
import { triviaResult, triviaRound } from 'lib/triviaFixtures'
import type { LeaderboardEntry, TriviaResult, TriviaRound, TriviaStanding } from 'shared/types'

interface Setup {
  round?: TriviaRound | null
  result?: TriviaResult | null
  answeredIdx?: number | null
  status?: { leadInEndsAt?: number, leadInQueueId?: number, sentAt?: number }
  leaderboard?: LeaderboardEntry[]
}

const render = ({ round = null, result = null, answeredIdx = null, status = {}, leaderboard = [] }: Setup) => {
  // one state object, so every read of it is the same read
  const state = {
    trivia: { round, result, answeredIdx, resolvedQueueId: null as number | null },
    user: { userId: 7, roomId: 1, avatarId: 'p1' },
    rooms: { entities: { 1: { name: 'Loveshack' } }, singerCount: 9 },
    status,
    points: { leaderboard },
  }

  return renderToStaticMarkup(
    <Provider store={{ getState: () => state, subscribe: () => () => {}, dispatch: () => {} } as never}>
      <MemoryRouter>
        <TriviaDialog />
      </MemoryRouter>
    </Provider>,
  )
}

const standing = (userId: number, name: string, points: number, numCorrect: number, avatarId = 'p1'): TriviaStanding => (
  { userId, name, avatarId, points, numCorrect }
)

const entry = (userId: number, points: number): LeaderboardEntry => (
  { userId, name: 'Me', avatarId: null, points, sings: 0, battleWins: 0, battlePlays: 0, triviaPoints: 0, triviaRounds: 0 }
)

describe('TriviaDialog', () => {
  /**
   * The phone is where the room actually looks during a round, so the beat
   * between questions has to land there too — a screen only the TV shows is
   * one half the party never sees.
   */
  it('counts who got it once the answer has been up', () => {
    const markup = render({ round: triviaRound(), result: triviaResult({ numCorrect: 2 }) })

    expect(markup).toContain('Who got it')
    expect(markup).toContain('>2<')
    expect(markup).toContain('got it')
  })

  it('keeps the final for the last question, after its count', () => {
    const standings = [standing(7, 'Dot Matrix', 1100, 5), standing(2, 'Barf', 900, 4)]
    const counting = render({
      round: triviaRound(),
      result: triviaResult({ isFinal: true, standings, boardFrom: Date.now() + 2000 }),
    })

    expect(counting).toContain('Who got it')
    expect(counting).not.toContain('YOU WIN')

    const board = render({
      round: triviaRound(),
      result: triviaResult({ isFinal: true, standings, boardFrom: Date.now() - 500 }),
      leaderboard: [entry(7, 2400)],
    })

    // 12g: you, what you made this round, and the night it leaves you on
    expect(board).toContain('>Final<')
    expect(board).toContain('YOU WIN')
    expect(board).toContain('5/5 correct')
    expect(board).toContain('+1100')
    expect(board).toContain('>2400<')
    expect(board).toContain('Back to songs')
    // the winner card is for the people who did not win
    expect(board).not.toContain('won<')
  })

  /** 12g2: your place, your own character, and who took it. */
  it('names the winner to everyone who was not them', () => {
    const board = render({
      round: triviaRound(),
      result: triviaResult({
        isFinal: true,
        boardFrom: Date.now() - 500,
        standings: [
          standing(1, 'Jumpin Jammer', 1100, 5, 'halloween/hex'),
          standing(2, 'Barf', 900, 4),
          standing(7, 'Dot Matrix', 800, 3),
        ],
      }),
    })

    expect(board).toContain('3RD PLACE')
    expect(board).toContain('3/5 correct')
    expect(board).toContain('Jumpin Jammer won')
    expect(board).toContain('+800')
    // the winner's face, at the one cut every portrait takes
    expect(board).toContain('assets/battle/fighters/halloween/hex/views/portrait-80.png')
    // and your own character behind your place
    expect(board).toContain('assets/battle/fighters/default/belter/views/key.png')
  })

  /** The final rests until it is put away, rather than expiring under you. */
  it('rests on the final after the board has run out', () => {
    const markup = render({
      round: triviaRound({ endsAt: Date.now() - 30000 }),
      result: triviaResult({
        isFinal: true,
        standings: [standing(7, 'Dot Matrix', 1100, 5)],
        scoresFrom: Date.now() - 20000,
        boardFrom: Date.now() - 15000,
        endsAt: Date.now() - 9000,
      }),
    })

    expect(markup).toContain('YOU WIN')
    expect(markup).toContain('Back to songs')
  })

  /** A question's reveal that has run out is not a screen. */
  it('shows nothing once a mid-round reveal has run out', () => {
    expect(render({
      round: triviaRound({ endsAt: Date.now() - 30000 }),
      result: triviaResult({ scoresFrom: Date.now() - 5000, endsAt: Date.now() - 2000 }),
    })).toBe('')
  })

  /** 12e0: the TV is counting the round in, and the phones count with it. */
  it('gets the room ready while the TV counts the round in', () => {
    const markup = render({ status: { leadInEndsAt: Date.now() + 7500, leadInQueueId: 9 } })

    expect(markup).toContain('Get ready')
    expect(markup).toContain('TRIVIA')
    expect(markup).toContain('Starts in')
    expect(markup).toContain('0:08')
    expect(markup).toContain('5 questions · 1100 pts up for grabs. Watch the TV, answer here.')
    expect(markup).toContain('9 players in')
  })

  /** The lead-in's end is by the server's clock, which this phone may disagree
   *  with by minutes: read through the stamp, it still counts with the TV. */
  it('counts the lead-in by the server\'s clock, not the phone\'s', () => {
    const skew = 60 * 60 * 1000
    const ahead = { leadInEndsAt: Date.now() + skew + 7500, sentAt: Date.now() + skew, leadInQueueId: 9 }
    const behind = { leadInEndsAt: Date.now() - skew + 7500, sentAt: Date.now() - skew, leadInQueueId: 9 }

    expect(render({ status: ahead })).toContain('0:08')
    expect(render({ status: behind })).toContain('0:08')
  })

  /** The whole round is in the hand: nobody has to look up at the TV to play. */
  it('carries the question and all four answers while answering is open', () => {
    const markup = render({ round: triviaRound({ answers: ['Ludicrous Speed', 'Ridiculous', 'Light', 'Plaid'] }) })

    expect(markup).toContain('Who?')
    for (const answer of ['Ludicrous Speed', 'Ridiculous', 'Light', 'Plaid']) {
      expect(markup).toContain(answer)
    }
    expect(markup).toContain('Q2 · Easy')
    expect(markup).toContain('100 pts')
    expect(markup).toContain('Loveshack')
    expect(markup).toContain('Tap to lock in · one answer')
    // the keys say what they are, not which they are
    expect(markup).not.toContain('numeral')
  })

  it('locks in one answer and says so', () => {
    const markup = render({ round: triviaRound(), answeredIdx: 1 })

    expect(markup).toContain('Locked in · waiting for the room')
    expect(markup).toMatch(/disabled=""/)
  })

  it('lights the right key once answering has closed', () => {
    const markup = render({
      round: triviaRound({ answers: ['Ludicrous Speed', 'Ridiculous', 'Light', 'Plaid'] }),
      result: triviaResult({ correctIdx: 0, scoresFrom: Date.now() + 5000 }),
    })

    // nothing picked: time ran out on you
    expect(markup).toContain('TIME&#x27;S UP')
    expect(markup).toContain('No answer · +0')
    // the correct key carries the answer's own text, after its letter
    expect(markup).toMatch(/class="[^"]*correct[^"]*"[^>]*><span[^>]*>A<\/span><span[^>]*>Ludicrous Speed/)
    expect(markup).toContain('>Answer<')
    expect(markup).not.toContain('Dot Matrix')
  })

  it('puts your wrong pick beside the answer', () => {
    const markup = render({
      round: triviaRound({ answers: ['Ludicrous Speed', 'Ridiculous', 'Light', 'Plaid'] }),
      result: triviaResult({ correctIdx: 0, scoresFrom: Date.now() + 5000 }),
      answeredIdx: 1,
    })

    expect(markup).toContain('WRONG')
    expect(markup).toContain('+0')
    expect(markup).toContain('Your pick')
    expect(markup).toContain('>Answer<')
    expect(markup.indexOf('Ridiculous')).toBeLessThan(markup.indexOf('Ludicrous Speed'))
  })

  it('counts a right answer for what it was worth', () => {
    const markup = render({
      round: triviaRound({ difficulty: 'medium' }),
      result: triviaResult({ correctIdx: 2, scoresFrom: Date.now() + 5000 }),
      answeredIdx: 2,
    })

    expect(markup).toContain('CORRECT')
    expect(markup).toContain('+200')
    expect(markup).toContain('Your pick')
    expect(markup).not.toContain('>Answer<')
    // the design always draws "Trivia standing"; not on the board yet is 0,
    // behind the fixture's one scorer
    expect(markup).toContain('Trivia standing')
    expect(markup).toContain('2nd · 0')

    // no row, behind every score but ahead of the zeros who did answer
    const unranked = render({
      round: triviaRound(),
      result: triviaResult({
        correctIdx: 0,
        scoresFrom: Date.now() + 5000,
        scores: [
          { userId: 42, name: 'Dot Matrix', score: 800, numAnswered: 4, avatarId: 'p1' },
          { userId: 43, name: 'Barf', score: 0, numAnswered: 2, avatarId: 'p1' },
        ],
      }),
    })

    expect(unranked).toContain('TIME')
    expect(unranked).toContain('2nd · 0')

    const standing = render({
      round: triviaRound(),
      result: triviaResult({
        correctIdx: 0,
        scoresFrom: Date.now() + 5000,
        scores: [
          { userId: 42, name: 'Dot Matrix', score: 800, numAnswered: 4, avatarId: 'p1' },
          { userId: 7, name: 'Me', score: 400, numAnswered: 4, avatarId: 'p1' },
        ],
      }),
      answeredIdx: 0,
    })

    expect(standing).toContain('Trivia standing')
    expect(standing).toContain('2nd · 400')
  })
})
