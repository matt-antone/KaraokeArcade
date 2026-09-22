import type { TriviaResult, TriviaRound } from 'shared/types'

/**
 * The two payloads a round is made of, for the screens that draw them.
 *
 * Test-only, and shared because the player and the phone draw the same round:
 * three copies of these had already drifted apart on which fields they set.
 */
export const triviaRound = (over: Partial<TriviaRound> = {}): TriviaRound => ({
  roundId: 1,
  queueId: 7,
  questionNumber: 2,
  questionCount: 5,
  question: 'Who?',
  answers: ['A', 'B', 'C', 'D'],
  difficulty: 'easy',
  endsAt: Date.now() + 20000,
  sentAt: Date.now(),
  ...over,
})

export const triviaResult = (over: Partial<TriviaResult> = {}): TriviaResult => ({
  roundId: 1,
  queueId: 7,
  questionNumber: 2,
  questionCount: 5,
  isFinal: false,
  correctIdx: 0,
  scores: [{ userId: 42, name: 'Dot Matrix', score: 3, numAnswered: 4, avatarId: 'p1' }],
  numCorrect: 1,
  // already past, so the beat after the answer is what a bare call renders
  scoresFrom: Date.now() - 1000,
  boardFrom: null,
  endsAt: Date.now() + 2000,
  sentAt: Date.now(),
  ...over,
})
