import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Provider } from 'react-redux'
import { describe, it, expect } from 'vitest'
import TriviaDialog from './TriviaDialog'
import { triviaResult, triviaRound } from 'lib/triviaFixtures'
import type { TriviaResult, TriviaRound } from 'shared/types'

const render = (trivia: { round: TriviaRound, result: TriviaResult }) => renderToStaticMarkup(
  <Provider
    store={{
      getState: () => ({ trivia: { answeredIdx: null as number | null, ...trivia }, user: { userId: 7 } }),
      subscribe: () => () => {},
      dispatch: () => {},
    } as never}
  >
    <TriviaDialog />
  </Provider>,
)

const renderOpen = () => renderToStaticMarkup(
  <Provider
    store={{
      getState: () => ({
        trivia: {
          answeredIdx: null as number | null,
          round: triviaRound({ answers: ['Ludicrous Speed', 'Ridiculous', 'Light', 'Plaid'] }),
          result: null as TriviaResult | null,
        },
        user: { userId: 7 },
      }),
      subscribe: () => () => {},
      dispatch: () => {},
    } as never}
  >
    <TriviaDialog />
  </Provider>,
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

  it('keeps the standings for the last question, after its count', () => {
    const counting = render({
      round: triviaRound(),
      result: triviaResult({ isFinal: true, boardFrom: Date.now() + 2000 }),
    })

    expect(counting).toContain('Who got it')
    expect(counting).not.toContain('Dot Matrix')

    const board = render({
      round: triviaRound(),
      result: triviaResult({ isFinal: true, boardFrom: Date.now() - 500 }),
    })

    expect(board).toContain('Scores')
    expect(board).toContain('Dot Matrix')
  })

  it('puts each player\'s character on the board beside their name', () => {
    // A scoreboard of bare names is the one surface where the room cannot tell
    // who anybody is: nobody is on stage, so there is nothing else to go on.
    const board = render({
      round: triviaRound(),
      result: triviaResult({
        isFinal: true,
        boardFrom: Date.now() - 500,
        scores: [
          { userId: 1, name: 'Dot Matrix', score: 3, numAnswered: 3, avatarId: 'p1' },
          { userId: 2, name: 'Barf', score: 2, numAnswered: 3, avatarId: 'halloween/hex' },
          { userId: 3, name: 'Vespa', score: 2, numAnswered: 2, avatarId: 'p3' },
          // fourth and below is a scoreboard row rather than a podium block
          { userId: 4, name: 'Lone Starr', score: 1, numAnswered: 3, avatarId: 'p4' },
        ],
      }),
    })

    // the podium, drawn at the larger cut
    expect(board).toContain('assets/battle/fighters/halloween/hex/views/portrait-80.png')
    // and the rows under it
    expect(board).toContain('assets/battle/fighters/default/diva/views/portrait-34.png')
  })

  /** The whole round is in the hand: nobody has to look up at the TV to play. */
  it('carries the question and all four answers while answering is open', () => {
    const markup = renderOpen()

    expect(markup).toContain('Who?')
    for (const answer of ['Ludicrous Speed', 'Ridiculous', 'Light', 'Plaid']) {
      expect(markup).toContain(answer)
    }
    // the keys say what they are, not which they are
    expect(markup).not.toContain('numeral')
  })

  it('lights the right key once answering has closed', () => {
    const markup = render({
      round: triviaRound({ answers: ['Ludicrous Speed', 'Ridiculous', 'Light', 'Plaid'] }),
      result: triviaResult({ correctIdx: 0, scoresFrom: Date.now() + 5000 }),
    })

    // the correct key carries the answer's own text
    expect(markup).toMatch(/class="[^"]*correct[^"]*"[^>]*>[^<]*<span[^>]*>Ludicrous Speed/)
    expect(markup).not.toContain('Dot Matrix')
  })
})
