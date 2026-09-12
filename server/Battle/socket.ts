import Battle from './Battle.js'
import {
  BATTLE_ACCEPT,
  BATTLE_CANCEL,
  BATTLE_CHALLENGE,
  BATTLE_DECLINE,
  BATTLE_PICK,
  BATTLE_REQ_SINGERS,
  BATTLE_REQ_TURN,
  BATTLE_SCORE,
  BATTLE_SINGERS,
  BATTLE_SONG_ENDED,
  BATTLE_VOTE,
  _ERROR,
  _SUCCESS,
} from '../../shared/actionTypes.js'
import type { BattleSide } from '../../shared/types.js'

/** Which fighter a payload is about, narrowed to the two values that exist.
 *  Anything else is the challenger, which is the harmless reading: side 1 is
 *  also what a payload with no side at all means. */
const toSide = (side: unknown): BattleSide => (side === 2 ? 2 : 1)

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  // Who is in the room to fight. Answered to the asking socket alone: this is
  // a list of people, assembled the moment somebody opened the dialog, and it
  // is nobody else's business and stale within seconds for anyone else.
  [BATTLE_REQ_SINGERS]: async (sock, action, acknowledge) => {
    const { roomId, userId } = sock.user

    if (typeof roomId !== 'number') {
      return acknowledge({
        type: BATTLE_REQ_SINGERS + _ERROR,
        error: 'You\'re not in a room',
      })
    }

    sock.server.to(sock.id).emit('action', {
      type: BATTLE_SINGERS,
      payload: await Battle.getSingers(sock.server, roomId, userId),
    })

    acknowledge({ type: BATTLE_REQ_SINGERS + _SUCCESS })
  },
  // The challenger picked an opponent and a song for them to sing. queueId is
  // the turn the challenger is putting up to fight in, or 0 if they have none
  // waiting — Battle.pick appends in that case rather than refusing.
  [BATTLE_CHALLENGE]: async (sock, { payload }, acknowledge) => {
    const { roomId, userId } = sock.user

    if (typeof roomId !== 'number') {
      return acknowledge({
        type: BATTLE_CHALLENGE + _ERROR,
        error: 'You\'re not in a room',
      })
    }

    try {
      await Battle.challenge(sock.server, {
        roomId,
        challengerUserId: userId,
        opponentUserId: payload.opponentUserId,
        songId: payload.songId,
        queueId: payload.queueId,
      })
    } catch (err) {
      return acknowledge({
        type: BATTLE_CHALLENGE + _ERROR,
        error: err.message,
      })
    }

    acknowledge({ type: BATTLE_CHALLENGE + _SUCCESS })
  },
  [BATTLE_ACCEPT]: async (sock, action, acknowledge) => {
    const { roomId, userId } = sock.user

    if (typeof roomId !== 'number') {
      return acknowledge({
        type: BATTLE_ACCEPT + _ERROR,
        error: 'You\'re not in a room',
      })
    }

    try {
      await Battle.accept(sock.server, roomId, userId)
    } catch (err) {
      return acknowledge({
        type: BATTLE_ACCEPT + _ERROR,
        error: err.message,
      })
    }

    acknowledge({ type: BATTLE_ACCEPT + _SUCCESS })
  },
  // Declining and backing out are the same operation from the two ends of the
  // challenge, so both types route to the one method. Battle.clearInvite is
  // what checks the caller is actually one of the two fighters.
  [BATTLE_DECLINE]: async (sock, action, acknowledge) => {
    const { roomId, userId } = sock.user

    if (typeof roomId !== 'number') {
      return acknowledge({
        type: BATTLE_DECLINE + _ERROR,
        error: 'You\'re not in a room',
      })
    }

    try {
      await Battle.clearInvite(sock.server, roomId, userId)
    } catch (err) {
      return acknowledge({
        type: BATTLE_DECLINE + _ERROR,
        error: err.message,
      })
    }

    acknowledge({ type: BATTLE_DECLINE + _SUCCESS })
  },
  [BATTLE_CANCEL]: async (sock, action, acknowledge) => {
    const { roomId, userId } = sock.user

    if (typeof roomId !== 'number') {
      return acknowledge({
        type: BATTLE_CANCEL + _ERROR,
        error: 'You\'re not in a room',
      })
    }

    try {
      await Battle.clearInvite(sock.server, roomId, userId)
    } catch (err) {
      return acknowledge({
        type: BATTLE_CANCEL + _ERROR,
        error: err.message,
      })
    }

    acknowledge({ type: BATTLE_CANCEL + _SUCCESS })
  },
  // The opponent chose what the challenger sings. That is the last thing
  // missing, so this is where the queue row appears.
  [BATTLE_PICK]: async (sock, { payload }, acknowledge) => {
    const { roomId, userId } = sock.user

    if (typeof roomId !== 'number') {
      return acknowledge({
        type: BATTLE_PICK + _ERROR,
        error: 'You\'re not in a room',
      })
    }

    try {
      await Battle.pick(sock.server, roomId, userId, payload.songId)
    } catch (err) {
      return acknowledge({
        type: BATTLE_PICK + _ERROR,
        error: err.message,
      })
    }

    acknowledge({ type: BATTLE_PICK + _SUCCESS })
  },
  // The player reached a battle row. It asks rather than starts, for the same
  // reason a trivia round does: every beat boundary has to be the room's, or
  // two players in one room disagree about when the two minutes were up.
  //
  // Three-valued for the reason spelled out on TRIVIA_REQ_ROUND. "Already
  // running on this row" and "there is nothing to run here" are opposite
  // answers — wait versus move on — and collapsing them into one falsy flag
  // ends the feature after its first beat under React's double-invoked
  // effects, which development guarantees.
  [BATTLE_REQ_TURN]: (sock, { payload }, acknowledge) => {
    const { roomId } = sock.user
    const { queueId } = payload

    if (typeof roomId !== 'number') {
      return acknowledge({
        type: BATTLE_REQ_TURN + _ERROR,
        error: 'You\'re not in a room',
      })
    }

    const status = Battle.isTurnInProgress(roomId, queueId)
      ? 'inProgress'
      : Battle.startTurn(sock.server, roomId, queueId, !!payload.canHearRoom)
        ? 'started'
        : 'unavailable'

    acknowledge({
      type: BATTLE_REQ_TURN + _SUCCESS,
      payload: { queueId, status },
    })
  },
  // A song ran out inside its two minutes. Only the player can know this, and
  // Battle.songEnded ignores anything that does not match the beat actually on
  // stage, so a stale report costs nothing.
  [BATTLE_SONG_ENDED]: (sock, { payload }, acknowledge) => {
    const { roomId } = sock.user

    if (typeof roomId !== 'number') {
      return acknowledge({
        type: BATTLE_SONG_ENDED + _ERROR,
        error: 'You\'re not in a room',
      })
    }

    Battle.songEnded(sock.server, roomId, payload.queueId, toSide(payload.side))
    acknowledge({ type: BATTLE_SONG_ENDED + _SUCCESS })
  },
  // One phone's vote in a silent ballot. Battle.vote ignores anything that is
  // not the ballot beat of the battle actually running, so a tap that lands
  // after the beat closed costs nothing and says nothing.
  //
  // userId rather than socket id: one person with a phone and a tablet is the
  // ordinary case in this codebase, and it is one person's vote.
  [BATTLE_VOTE]: (sock, { payload }, acknowledge) => {
    const { roomId, userId } = sock.user

    if (typeof roomId !== 'number') {
      return acknowledge({
        type: BATTLE_VOTE + _ERROR,
        error: 'You\'re not in a room',
      })
    }

    Battle.vote(roomId, payload.queueId, userId, toSide(payload.side))
    acknowledge({ type: BATTLE_VOTE + _SUCCESS })
  },
  // How loud the room was for one fighter, measured by the machine with the
  // microphone.
  //
  // ponytail: not restricted to the player socket. There is no "is the player"
  // check anywhere in this codebase beyond the _lastPlayerStatus tell, and
  // requiring that here would make a battle unwinnable on a player that had
  // not yet sent a status — a silent failure, traded against a phone being
  // able to post its own grade. If it ever matters, gate on _lastPlayerStatus
  // and have the player send a status before requesting the turn.
  [BATTLE_SCORE]: (sock, { payload }, acknowledge) => {
    const { roomId } = sock.user

    if (typeof roomId !== 'number') {
      return acknowledge({
        type: BATTLE_SCORE + _ERROR,
        error: 'You\'re not in a room',
      })
    }

    Battle.score(sock.server, roomId, payload.queueId, toSide(payload.side), payload.score)
    acknowledge({ type: BATTLE_SCORE + _SUCCESS })
  },
}

export default ACTION_HANDLERS
