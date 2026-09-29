import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Provider } from 'react-redux'
import { describe, it, expect } from 'vitest'
import PlayerTrivia, { PlayerTriviaSplash } from './PlayerTrivia'
import { triviaResult, triviaRound } from 'lib/triviaFixtures'
import type { LeaderboardEntry, TriviaStanding } from 'shared/types'

const entry = (userId: number, name: string, points: number): LeaderboardEntry => (
  { userId, name, avatarId: null, points, sings: 0, battleWins: 0, battlePlays: 0, triviaPoints: 0, triviaRounds: 0 }
)

const store = (leaderboard: LeaderboardEntry[] = []) => ({
  getState: () => ({
    user: { roomId: 1 },
    rooms: { entities: { 1: { name: 'Loveshack' } } },
    points: { leaderboard },
  }),
  subscribe: () => () => {},
  dispatch: () => {},
}) as never

const render = (props: Partial<React.ComponentProps<typeof PlayerTrivia>>, leaderboard?: LeaderboardEntry[]) =>
  renderToStaticMarkup(
    <Provider store={store(leaderboard)}>
      <PlayerTrivia round={triviaRound()} width={1280} height={720} {...props} />
    </Provider>,
  )

const standing = (userId: number, name: string, points: number, numCorrect: number): TriviaStanding => (
  { userId, name, avatarId: 'p1', points, numCorrect }
)

const STANDINGS = [
  standing(1, 'Dot Matrix', 1100, 5),
  standing(2, 'Barf', 900, 4),
  standing(3, 'Vespa', 800, 3),
  standing(4, 'Lone Starr', 100, 1),
]

describe('PlayerTrivia', () => {
  /**
   * Between questions the room wants to know how it did, not where the night
   * stands — the standings still have four questions to settle, and this beat
   * lasts three seconds.
   */
  it('counts who got it after a question that is not the last', () => {
    const markup = render({ result: triviaResult({ numCorrect: 3 }) })

    expect(markup).toContain('got it')
    expect(markup).toContain('>3<')
    // the standings are the last question's beat, not this one's
    expect(markup).not.toContain('Trivia · final')
    expect(markup).not.toContain('Dot Matrix')
  })

  /** Zero needs no special case: it is a count like any other. */
  it('counts a question nobody got', () => {
    const markup = render({ result: triviaResult({ numCorrect: 0 }) })

    expect(markup).toContain('>0<')
  })

  /** 12d holds the whole of the final board: the round's winner, what they
   *  made, the runners-up, and the word art. */
  it('crowns the round\'s winner once the board is due', () => {
    const over = render({
      result: triviaResult({ isFinal: true, standings: STANDINGS, boardFrom: Date.now() - 500, endsAt: Date.now() + 5500 }),
    })

    expect(over).toContain('Trivia · final')
    expect(over).toContain('>Dot Matrix<')
    expect(over).not.toContain('Dot Matrix wins')
    expect(over).toContain('+1100')
    expect(over).toContain('this round · 5/5 correct')
    expect(over).toContain('Runners-up')
    expect(over).toContain('Barf')
    expect(over).toContain('Vespa')
    // second and third only
    expect(over).not.toContain('Lone Starr')
    expect(over).toContain('alt="Wins"')
    expect(over).toContain('alt="Game over"')
  })

  /** The board already carries the round, so the total counts up from the
   *  night before it. */
  it('counts the winner\'s night up from before the round', () => {
    const over = render(
      { result: triviaResult({ isFinal: true, standings: STANDINGS, boardFrom: Date.now() - 500 }) },
      [entry(1, 'Dot Matrix', 2300)],
    )

    expect(over).toContain('Tonight')
    expect(over).toContain('>1200<')
  })

  /** A tie names nobody: no WINS under two people. */
  it('calls a tie a tie', () => {
    const tie = render({
      result: triviaResult({
        isFinal: true,
        standings: [standing(1, 'Dot Matrix', 600, 3), standing(2, 'Barf', 600, 2)],
        boardFrom: Date.now() - 500,
      }),
    })

    expect(tie).toContain('Tie game')
    expect(tie).not.toContain('alt="Wins"')
    expect(tie).toContain('alt="Game over"')
  })

  it('says so when nobody played the round', () => {
    const empty = render({ result: triviaResult({ isFinal: true, boardFrom: Date.now() - 500 }) })

    expect(empty).toContain('Nobody played')
  })

  /** The design draws no urgency state: the clock runs out as it ran. */
  it('does not escalate for the last five seconds', () => {
    const late = render({ round: triviaRound({ endsAt: Date.now() + 3000 }) })

    expect(late).not.toContain('lock it in')
    expect(late).toContain('0:03')
  })

  /** The last question keeps its count, like every other question, and the
   *  winner only once boardFrom has passed. */
  it('counts the last question before it crowns anyone', () => {
    const counting = render({
      result: triviaResult({ isFinal: true, standings: STANDINGS, boardFrom: Date.now() + 2000 }),
    })

    expect(counting).toContain('got it')
    expect(counting).not.toContain('Trivia · final')
    expect(counting).not.toContain('Dot Matrix')

    const board = render({ result: triviaResult({ isFinal: true, standings: STANDINGS, boardFrom: Date.now() - 500 }) })

    expect(board).toContain('Trivia · final')
    expect(board).toContain('Dot Matrix')
  })

  /**
   * The player is whatever box is wired to the TV, and its clock is nobody's
   * responsibility. Read against the server's own stamp, a minute of skew
   * changes nothing; read against Date.now(), a three-second beat vanishes.
   */
  it('reaches the beat on a player whose clock disagrees with the server', () => {
    const skewed = triviaResult({
      // this room's server believes it is a minute later than the player does
      sentAt: Date.now() + 60000,
      scoresFrom: Date.now() + 59000,
      endsAt: Date.now() + 62000,
    })

    expect(render({ result: skewed })).toContain('got it')
  })

  it('shows the answer, not the standings, until the count is due', () => {
    const markup = render({ result: triviaResult({ scoresFrom: Date.now() + 5000 }) })

    expect(markup).not.toContain('Dot Matrix')
    expect(markup).not.toContain('got it')
    expect(markup).toContain('Answer')
  })

  /** OpenTDB is CC BY-SA 4.0: the credit rides under every question. */
  it('credits the questions under the question and its answer', () => {
    expect(render({})).toContain('Questions from opentdb.com')
    expect(render({ result: triviaResult({ scoresFrom: Date.now() + 5000 }) })).toContain('Questions from opentdb.com')
  })

  /** The title card stands up the night's leaders, and says nothing when
   *  nobody has scored yet rather than an empty row. */
  it('shows the night\'s top five scorers on the splash, and hides a board with none', () => {
    const splash = (leaderboard: LeaderboardEntry[]) => renderToStaticMarkup(
      <Provider store={store(leaderboard)}>
        <PlayerTriviaSplash width={1280} height={720} />
      </Provider>,
    )

    const board = splash(Array.from({ length: 7 }, (_, i) => entry(i, `P${i}`, 700 - i * 100)))
    expect(board).toContain('Loveshack')
    expect(board).toContain('Tonight&#x27;s top 5')
    expect(board).toContain('P4')
    expect(board).not.toContain('P5')

    expect(splash([])).not.toContain('Tonight')

    // joining puts a guest on the board at 0, which is not a score
    expect(splash([entry(1, 'P1', 0), entry(2, 'P2', 0)])).not.toContain('Tonight')
    expect(splash([entry(1, 'P1', 150), entry(2, 'P2', 0)])).toContain('Tonight&#x27;s top 1')
  })

  /** "Starting in" counts the gap down, and holds at 0 while the round is on
   *  its way. */
  it('counts the round in on the splash', () => {
    const splash = (intermissionEndsAt?: number | null) => renderToStaticMarkup(
      <Provider store={store()}>
        <PlayerTriviaSplash intermissionEndsAt={intermissionEndsAt} width={1280} height={720} />
      </Provider>,
    )

    expect(splash(Date.now() + 4500)).toContain('Starting in 5')
    expect(splash(null)).toContain('Starting in 0')
    expect(splash(Date.now() - 1000)).toContain('Starting in 0')
    expect(splash(null)).toContain('Questions from opentdb.com')
  })
})
