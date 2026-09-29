import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Provider } from 'react-redux'
import { describe, it, expect } from 'vitest'
import PlayerTrivia, { PlayerTriviaSplash } from './PlayerTrivia'
import { triviaResult, triviaRound } from 'lib/triviaFixtures'
import type { LeaderboardEntry } from 'shared/types'

const render = (props: Partial<React.ComponentProps<typeof PlayerTrivia>>) =>
  renderToStaticMarkup(<PlayerTrivia round={triviaRound()} width={1280} height={720} {...props} />)

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
    expect(markup).not.toContain('scores')
    expect(markup).not.toContain('Dot Matrix')
  })

  /** Zero needs no special case: it is a count like any other. */
  it('counts a question nobody got', () => {
    const markup = render({ result: triviaResult({ numCorrect: 0 }) })

    expect(markup).toContain('>0<')
  })

  /** The final board's hold is split: the standings first, then the winner. */
  it('crowns the winner once the standings have had their half', () => {
    const standings = render({ result: triviaResult({ isFinal: true, boardFrom: Date.now() - 500, endsAt: Date.now() + 5000 }) })

    expect(standings).toContain('high scores')
    expect(standings).not.toContain('wins')

    const over = render({ result: triviaResult({ isFinal: true, boardFrom: Date.now() - 5000, endsAt: Date.now() + 500 }) })

    expect(over).toContain('Dot Matrix wins')
  })

  it('escalates to lock it in for the last five seconds', () => {
    expect(render({ round: triviaRound({ endsAt: Date.now() + 12000 }) })).not.toContain('lock it in')
    expect(render({ round: triviaRound({ endsAt: Date.now() + 3000 }) })).toContain('lock it in')
  })

  /** The last question earns a third beat: the count first, like every other
   *  question, and the standings only once boardFrom has passed. */
  it('counts the last question before it stands anyone up', () => {
    const counting = render({ result: triviaResult({ isFinal: true, boardFrom: Date.now() + 2000 }) })

    expect(counting).toContain('got it')
    expect(counting).not.toContain('scores')

    const board = render({ result: triviaResult({ isFinal: true, boardFrom: Date.now() - 500 }) })

    expect(board).toContain('scores')
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

  it('shows the answer, not the standings, until the scoreboard is due', () => {
    const markup = render({ result: triviaResult({ scoresFrom: Date.now() + 5000 }) })

    expect(markup).not.toContain('Dot Matrix')
    expect(markup).toContain('answer')
  })

  /** The title card stands up the night's leaders, and says nothing when
   *  nobody has scored yet rather than an empty row. */
  it('shows the night\'s top five on the splash, and hides an empty board', () => {
    const splash = (leaderboard: LeaderboardEntry[]) => renderToStaticMarkup(
      <Provider
        store={{
          getState: () => ({
            user: { roomId: 1 },
            rooms: { entities: { 1: { name: 'Loveshack' } } },
            points: { leaderboard },
          }),
          subscribe: () => () => {},
          dispatch: () => {},
        } as never}
      >
        <PlayerTriviaSplash width={1280} height={720} />
      </Provider>,
    )

    const board = splash(Array.from({ length: 7 }, (_, i): LeaderboardEntry => ({ userId: i, name: `P${i}`, avatarId: null, points: 700 - i * 100 })))
    expect(board).toContain('Loveshack')
    expect(board).toContain('Tonight&#x27;s top 5')
    expect(board).toContain('P4')
    expect(board).not.toContain('P5')

    expect(splash([])).not.toContain('Tonight')
  })
})
