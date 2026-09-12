import Rooms from './Rooms.js'
import Battle from '../Battle/Battle.js'
import Queue from '../Queue/Queue.js'
import Trivia from '../Trivia/Trivia.js'
import {
  BATTLE_INVITE_CLEAR,
  BATTLE_TURN_CLEAR,
  PLAYER_CMD_HISTORY_RESET,
  PLAYER_CMD_PAUSE,
  QUEUE_PUSH,
  ROOM_STATUS_PUSH,
} from '../../shared/actionTypes.js'

/**
 * Move a room's transport and do what the new state means.
 *
 * Recording the status is the small half: Rooms.validate reads it and that is
 * what shuts the door on new singers and new queue entries. The rest is what
 * has to happen to a room that is already running.
 *
 * Separate from the route so the transitions can be exercised without a Koa
 * context; the route is the caller that has the socket server.
 */
export default function setRoomTransport (io, roomId: number, status: string): void {
  Rooms.setStatus(roomId, status)

  // Everyone in the room, not just the admin who pressed the key. Until this
  // went out, a transport change reached the phones only as its consequences —
  // an emptied queue, a paused player — and nothing said what had happened, so
  // the library went on offering songs that the server would refuse. Its own
  // action rather than the room list or ROOM_PREFS_PUSH: those carry the room's
  // prefs, which include the QR panel's join password, and this has to reach
  // singers rather than only admins.
  io.to(Rooms.prefix(roomId)).emit('action', {
    type: ROOM_STATUS_PUSH,
    payload: { roomId, status },
  })

  // Both non-playing states take the room off the stage. Whatever was up would
  // otherwise keep playing to a room that has just been closed out from under
  // it — the singer has stopped, and the screen should agree.
  if (status !== 'play') {
    io.to(Rooms.prefix(roomId)).emit('action', { type: PLAYER_CMD_PAUSE })
  }

  if (status !== 'stopped') return

  // The night is over: the queue goes, every sitting-out pause with it, and the
  // scoreboard starts empty for whoever is here next. Pause deliberately does
  // none of this — the whole difference between the two states is what stop
  // throws away.
  Queue.clear(roomId)
  Trivia.resetScores(roomId)

  // a round still in flight is asking a question on a queue row that no longer
  // exists, and would re-queue its successor into the room just emptied.
  // Stopping it also drops its timers.
  Trivia.stopRoom(roomId)

  // and a battle mid-fight has nine timers' worth of beats still to emit onto
  // a queue row that went with Queue.clear above. Same bug, same fix — this is
  // the place a timer outliving its room actually gets caught. It also drops
  // any challenge being negotiated, which would otherwise resolve into a queue
  // row in a room that has closed for the night.
  Battle.stopRoom(roomId)

  // Battle.stopRoom is silent, which is right for its other caller — a room
  // being deleted has nobody left to tell — and wrong here: stopping a room
  // disconnects nobody, and the three emits below prove the recipients are
  // still there. Without these the server has destroyed a fight the room is
  // still watching. The beat would sit on the player and on every phone's
  // strip until its own deadline ran out, up to two minutes on a singing
  // beat, and a challenge waiting for an answer would sit in its modal
  // forever — an invite has no deadline to expire against, unlike a trivia
  // round, so nothing else would ever take it down.
  //
  // Broadcast rather than sent to the two fighters the way every other invite
  // emit is. The rule that keeps a negotiation off the television is about not
  // *showing* the room a challenge; INVITE_CLEAR carries no payload and only
  // ever empties state that is already empty on anyone else's phone.
  io.to(Rooms.prefix(roomId)).emit('action', { type: BATTLE_TURN_CLEAR })
  io.to(Rooms.prefix(roomId)).emit('action', { type: BATTLE_INVITE_CLEAR })

  io.to(Rooms.prefix(roomId)).emit('action', {
    type: QUEUE_PUSH,
    payload: Queue.get(roomId),
  })

  // the played list lives in the running player, not the database, so it takes
  // a command. With no player connected this is a no-op.
  io.to(Rooms.prefix(roomId)).emit('action', { type: PLAYER_CMD_HISTORY_RESET })
}
