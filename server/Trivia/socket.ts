import Trivia from './Trivia.js'
import {
  TRIVIA_ANSWER,
  TRIVIA_REQ_ROUND,
  TRIVIA_SCORES_RESET,
  _ERROR,
} from '../../shared/actionTypes.js'

const ACTION_HANDLERS = {
  // Older players may still request a queued full round; let them advance.
  [TRIVIA_REQ_ROUND]: async (_sock, { payload }, acknowledge) => {
    const { queueId } = payload
    const status = 'unavailable'

    acknowledge({
      type: TRIVIA_REQ_ROUND + '_SUCCESS',
      payload: { queueId, status },
    })
  },
  // Anyone in the room may answer, singer or not — giving the quiet guests
  // something to play is the point, so this deliberately does not check for a
  // queue entry.
  [TRIVIA_ANSWER]: (sock, { payload }, acknowledge) => {
    try {
      Trivia.answer({
        roomId: sock.user.roomId,
        userId: sock.user.userId,
        roundId: payload.roundId,
        answerIdx: payload.answerIdx,
      })
    } catch (err) {
      return acknowledge({
        type: TRIVIA_ANSWER + _ERROR,
        error: err.message,
      })
    }

    acknowledge({ type: TRIVIA_ANSWER + '_SUCCESS' })
  },
  // The roomId is in the payload rather than taken from the socket: an admin
  // resets scores from Settings > Rooms, where the room being edited is very
  // often not the room they are signed into.
  [TRIVIA_SCORES_RESET]: (sock, { payload }, acknowledge) => {
    const roomId = payload?.roomId ?? sock.user.roomId

    if (!sock.user.isAdmin || typeof roomId !== 'number') {
      return acknowledge({
        type: TRIVIA_SCORES_RESET + _ERROR,
        error: 'Unauthorized',
      })
    }

    Trivia.resetScores(roomId)
    acknowledge({ type: TRIVIA_SCORES_RESET + '_SUCCESS' })
  },
}

export default ACTION_HANDLERS
