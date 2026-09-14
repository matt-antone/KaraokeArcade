import { createAction, createReducer } from '@reduxjs/toolkit'
import type { AppThunk } from 'store/store'
import type { TriviaResult, TriviaRound, TriviaRoundRequestStatus } from 'shared/types'
import {
  LOGOUT,
  TRIVIA_ANSWER,
  TRIVIA_REQ_ROUND,
  TRIVIA_RESULT,
  TRIVIA_ROUND,
  _ERROR,
} from 'shared/actionTypes'

const triviaRound = createAction<TriviaRound>(TRIVIA_ROUND)
const triviaResult = createAction<TriviaResult>(TRIVIA_RESULT)
const triviaAnswer = createAction<{ roundId: number, answerIdx: number }>(TRIVIA_ANSWER)
const triviaAnswerError = createAction(TRIVIA_ANSWER + _ERROR)
const triviaRoundRequested = createAction<{ queueId: number, status: TriviaRoundRequestStatus }>(TRIVIA_REQ_ROUND + '_SUCCESS')
const logout = createAction(LOGOUT)

/** Ask the server to put the question for a trivia row in front of the room.
 *  Only the player sends this, on reaching the row. */
export function requestTriviaRound (queueId: number) {
  return { type: TRIVIA_REQ_ROUND, payload: { queueId } }
}

/**
 * Lock in an answer. Applied here the moment it is sent so the key reads as
 * pressed straight away — on a phone at a party the round is over in seconds
 * and a round trip is long enough to tap twice. The server refuses a second
 * answer either way, and its rejection puts the keys back.
 */
export function answerTrivia (roundId: number, answerIdx: number): AppThunk {
  return (dispatch) => {
    dispatch({
      type: TRIVIA_ANSWER,
      payload: { roundId, answerIdx },
    })
  }
}

export interface TriviaState {
  /** The question on screen, or null between rounds. Stays put through the
   *  reveal so the player can show the answers alongside the right one. */
  round: TriviaRound | null
  /** Set once answering closes; carries the right answer and the scoreboard. */
  result: TriviaResult | null
  /** Which key this device pressed this round, if any. */
  answeredIdx: number | null
  /** The trivia queue row the server has finished with — either its round has
   *  been asked and closed, or it declined to ask one at all. The player waits
   *  for this before moving on, so it never skips a round that is about to
   *  arrive, and never sits for ever on one that is not coming. */
  resolvedQueueId: number | null
}

const initialState: TriviaState = {
  round: null,
  result: null,
  answeredIdx: null,
  resolvedQueueId: null,
}

const triviaReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(triviaRound, (_state, { payload }) => ({
      round: payload,
      result: null,
      answeredIdx: null,
      resolvedQueueId: null,
    }))
    .addCase(triviaRoundRequested, (state, { payload }) => {
      // Only "there is nothing to play here" frees the player. 'inProgress'
      // means a round is already under way on this row — which is what a
      // duplicate request looks like — and must leave it waiting.
      if (payload.status === 'unavailable') state.resolvedQueueId = payload.queueId
    })
    .addCase(triviaResult, (state, { payload }) => {
      // a result for a round this client never saw would strand the reveal
      // with no question behind it
      if (!state.round || state.round.roundId !== payload.roundId) return state

      // Only the last question of the round frees the player to move on: the
      // others are followed by another question on the same queue row.
      return {
        ...state,
        result: payload,
        resolvedQueueId: payload.isFinal ? payload.queueId : state.resolvedQueueId,
      }
    })
    .addCase(triviaAnswer, (state, { payload }) => {
      state.answeredIdx = payload.answerIdx
    })
    .addCase(triviaAnswerError, (state) => {
      state.answeredIdx = null
    })
    .addCase(logout, () => initialState)
})

export default triviaReducer
