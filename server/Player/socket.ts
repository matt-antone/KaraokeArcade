import Battle from '../Battle/Battle.js'
import Points from '../Points/Points.js'
import Rooms from '../Rooms/Rooms.js'
import Trivia from '../Trivia/Trivia.js'
import User from '../User/User.js'

import {
  PLAYER_CMD_NEXT,
  PLAYER_CMD_OPTIONS,
  PLAYER_CMD_PAUSE,
  PLAYER_CMD_PLAY,
  PLAYER_CMD_REPLAY,
  PLAYER_CMD_VOLUME,
  PLAYER_REQ_NEXT,
  PLAYER_REQ_OPTIONS,
  PLAYER_REQ_PAUSE,
  PLAYER_REQ_PLAY,
  PLAYER_REQ_REPLAY,
  PLAYER_REQ_VOLUME,
  PLAYER_EMIT_STATUS,
  PLAYER_EMIT_LEAVE,
  PLAYER_STATUS,
  PLAYER_LEAVE,
  SONG_PLAYED,
} from '../../shared/actionTypes.js'

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  [PLAYER_REQ_OPTIONS]: (sock, { payload }) => {
    // @todo: emit to players only
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_OPTIONS,
      payload,
    })
  },
  [PLAYER_REQ_NEXT]: (sock) => {
    // A fight on stage is the KJ's to call off and nobody else's: the two
    // fighters agreed to it and the room is mid-ballot. Ending it is the skip —
    // the player moves on when the turn clears (see Battle.end), so no next
    // goes out as well.
    if (Battle.getTurn(sock.user.roomId)) {
      if (sock.user.isAdmin) Battle.end(sock.server, sock.user.roomId)
      return
    }

    // A round has no row-level end the player waits on, so the player is told
    // to move on as for a song — and the round is wound up here, or the phones
    // keep being asked questions about a row that has left the stage.
    Trivia.closeRound(sock.server, sock.user.roomId)

    // @todo: emit to players only
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_NEXT,
    })
  },
  [PLAYER_REQ_PAUSE]: (sock) => {
    // @todo: emit to players only
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_PAUSE,
    })
  },
  [PLAYER_REQ_PLAY]: (sock) => {
    // @todo: emit to players only
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_PLAY,
    })
  },
  [PLAYER_REQ_REPLAY]: (sock, { payload }) => {
    // @todo: emit to players only
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_REPLAY,
      payload,
    })
  },
  [PLAYER_REQ_VOLUME]: (sock, { payload }) => {
    // @todo: emit to players only
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_VOLUME,
      payload,
    })
  },
  [PLAYER_EMIT_STATUS]: (sock, { payload }) => {
    const wasPlayer = !!sock._lastPlayerStatus
    const wasPlaying = !!sock._lastPlayerStatus?.isPlaying

    // The lead-in's end is by the TV's clock, which on a box with no NTP can be
    // minutes out. Rebased onto ours by the TV's own send stamp, and restamped
    // on the way out, the phones read it through serverNow (12e0).
    if (typeof payload.leadInEndsAt === 'number' && typeof payload.sentAt === 'number') {
      payload.leadInEndsAt = Date.now() + (payload.leadInEndsAt - payload.sentAt)
    }

    // so we can tell the room when players leave and
    // relay last known player status on client join
    sock._lastPlayerStatus = payload

    // this socket is the TV, not a singer: take it out of the room's count
    if (!wasPlayer) Rooms.pushSingers(sock.server, sock.user.roomId)

    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_STATUS,
      payload: { ...payload, sentAt: Date.now() },
    })

    // A round is only put in the queue while something is on stage, so an idle
    // room has none waiting — this is the moment it gets one. On the edge
    // only: status lands several times a second while a song plays.
    if (!wasPlaying && payload.isPlaying) {
      Trivia.syncQueueAndPush(sock.server, sock.user.roomId)
    }
  },
  // the song left the stage, whether it ended on its own or was skipped
  [SONG_PLAYED]: (sock, { payload }) => {
    User.addPlay({ queueId: payload.queueId, roomId: sock.user.roomId })

    // Points only for a song sung to its end, and only on the player's word:
    // it is the one screen that knows whether a song ran out or was cut, and
    // it is admin-only, so a guest's phone cannot pay itself by sending this.
    if (sock.user.isAdmin && !payload.isSkipped) {
      Points.addSong(sock.user.roomId, payload.queueId)
      Points.push(sock.server, sock.user.roomId)
    }
  },
  [PLAYER_EMIT_LEAVE]: (sock) => {
    sock._lastPlayerStatus = null

    // left the player view but still connected: a singer again
    Rooms.pushSingers(sock.server, sock.user.roomId)

    // any players left in room?
    if (!Rooms.isPlayerPresent(sock.server, sock.user.roomId)) {
      sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
        type: PLAYER_LEAVE,
        payload: { socketId: sock.id },
      })
    }
  },
}

export default ACTION_HANDLERS
