import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, it, expect, vi } from 'vitest'
import PlayerTrivia from './PlayerTrivia'
import triviaReducer from 'store/modules/trivia'
import { TRIVIA_ROUND, TRIVIA_RESULT } from 'shared/actionTypes'
import type { TriviaResult, TriviaRound } from 'shared/types'

/**
 * The whole beat, driven through the real reducer: what the room sees is the
 * store's answer to a question payload, then a result payload, then time
 * passing. Asserting the component alone missed that the store is what feeds
 * it, and the sequence is the thing being asked for.
 */
const SERVER_T0 = 1_700_000_000_000

const round: TriviaRound = {
  roundId: 1,
  queueId: 7,
  questionNumber: 2,
  questionCount: 5,
  question: 'Who?',
  answers: ['A', 'B', 'C', 'D'],
  difficulty: 'easy',
  endsAt: SERVER_T0 + 20000,
  sentAt: SERVER_T0,
}

// what the server sends when answering closes, 20s in: 6s of answer, 3s of board
const result: TriviaResult = {
  roundId: 1,
  queueId: 7,
  questionNumber: 2,
  questionCount: 5,
  isFinal: false,
  correctIdx: 0,
  scores: [{ userId: 42, name: 'Dot Matrix', score: 3, numAnswered: 2, avatarId: 'p1' }],
  numCorrect: 2,
  scoresFrom: SERVER_T0 + 26000,
  boardFrom: null,
  endsAt: SERVER_T0 + 29000,
  sentAt: SERVER_T0 + 20000,
}

const screen = (state: ReturnType<typeof triviaReducer>) => renderToStaticMarkup(
  <PlayerTrivia round={state.round!} result={state.result} width={1280} height={720} />,
)

afterEach(() => {
  vi.useRealTimers()
})

describe('a round, beat by beat', () => {
  it('goes question, then answer, then how many got it', () => {
    vi.useFakeTimers()

    // the player's clock is a minute behind the server's, as a TV box's is
    vi.setSystemTime(SERVER_T0 - 60000)
    let state = triviaReducer(undefined, { type: TRIVIA_ROUND, payload: round })

    const question = screen(state)
    expect(question).toContain('Who?')
    expect(question).not.toContain('Dot Matrix')

    // answering closes
    vi.setSystemTime(SERVER_T0 + 20000 - 60000)
    state = triviaReducer(state, { type: TRIVIA_RESULT, payload: result })

    const answer = screen(state)
    expect(answer).toContain('answer')
    expect(answer).not.toContain('Dot Matrix')

    // 6s later the count takes the stage, and holds for 3s
    vi.setSystemTime(SERVER_T0 + 26500 - 60000)
    const tally = screen(state)
    expect(tally).toContain('who got it')
    expect(tally).toContain('>2<')

    vi.setSystemTime(SERVER_T0 + 28900 - 60000)
    expect(screen(state)).toContain('>2<')
  })
})
