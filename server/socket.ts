import getLogger from './lib/Log.js'
import jsonWebToken from 'jsonwebtoken'
import parseCookie from './lib/parseCookie.js'
import Battle from './Battle/Battle.js'
import BattleSocket from './Battle/socket.js'
import Library from './Library/Library.js'
import LibrarySocket from './Library/socket.js'
import PlayerSocket from './Player/socket.js'
import Prefs from './Prefs/Prefs.js'
import PrefsSocket from './Prefs/socket.js'
import Rooms, { STATUSES } from './Rooms/Rooms.js'
import RoomsSocket from './Rooms/socket.js'
import Queue from './Queue/Queue.js'
import QueueSocket from './Queue/socket.js'
import Trivia from './Trivia/Trivia.js'
import TriviaSocket from './Trivia/socket.js'

import {
  BATTLE_INVITE,
  BATTLE_TURN,
  LIBRARY_PUSH,
  QUEUE_PUSH,
  ROOM_STATUS_PUSH,
  STARS_PUSH,
  STAR_COUNTS_PUSH,
  PLAYER_STATUS,
  PLAYER_LEAVE,
  PREFS_PUSH,
  TRIVIA_ROUND,
  SOCKET_AUTH_ERROR,
  _ERROR,
} from '../shared/actionTypes.js'
const log = getLogger('server')

// Every 'server/' action type a client can send has to appear here. An
// unregistered one logs "No handler" and returns without ever calling
// acknowledge — and the client's optimistic transaction then waits for an
// answer that is never coming, for the life of the page.
const handlers = {
  ...BattleSocket,
  ...LibrarySocket,
  ...QueueSocket,
  ...PlayerSocket,
  ...PrefsSocket,
  ...RoomsSocket,
  ...TriviaSocket,
}

const { verify: jwtVerify } = jsonWebToken

export default function (io, jwtKey) {
  io.on('connection', (sock) => {
    const { keToken } = parseCookie(sock.handshake.headers.cookie)
    const clientLibraryVersion = parseInt(sock.handshake.query.library, 10)
    const clientStarsVersion = parseInt(sock.handshake.query.stars, 10)

    // authenticate the JWT sent via cookie in http handshake
    try {
      sock.user = jwtVerify(keToken, jwtKey)

      // success
      log.verbose('%s (%s) connected from %s', sock.user.name, sock.id, sock.handshake.address)
    } catch (err) {
      io.to(sock.id).emit('action', {
        type: SOCKET_AUTH_ERROR,
      })

      sock.user = null
      sock.disconnect()
      log.verbose('disconnected %s (%s)', sock.handshake.address, err.message)
      return
    }

    // attach disconnect handler
    sock.on('disconnect', (reason) => {
      log.verbose('%s (%s) disconnected (%s)',
        sock.user.name, sock.id, reason,
      )

      if (typeof sock.user.roomId !== 'number') return

      // beyond this point assumes there is a room

      log.verbose('%s (%s) left room %s (%s; %s in room)',
        sock.user.name, sock.id, sock.user.roomId, reason, sock.adapter.rooms.size,
      )

      // any players left in room?
      if (!Rooms.isPlayerPresent(io, sock.user.roomId)) {
        io.to(Rooms.prefix(sock.user.roomId)).emit('action', {
          type: PLAYER_LEAVE,
          payload: { socketId: sock.id },
        })
      }
    })

    // attach action handler
    sock.on('action', async (action, acknowledge) => {
      const { type } = action

      if (!sock.user) {
        return acknowledge({
          type: SOCKET_AUTH_ERROR,
        })
      }

      if (typeof handlers[type] !== 'function') {
        log.error('No handler for socket action: %s', type)
        return
      }

      try {
        await handlers[type](sock, action, acknowledge)
      } catch (err) {
        log.error(err)

        return acknowledge({
          type: type + _ERROR,
          error: `Error in ${type}: ${err.message}`,
        })
      }
    })

    // push prefs (admin only)
    if (sock.user.isAdmin) {
      log.verbose('pushing prefs to %s (%s)', sock.user.name, sock.id)
      io.to(sock.id).emit('action', {
        type: PREFS_PUSH,
        payload: Prefs.get(),
      })
    }

    // push library (only if client's is outdated)
    if (clientLibraryVersion !== Library.cache.version) {
      log.verbose('pushing library to %s (%s) (client=%s, server=%s)',
        sock.user.name, sock.id, clientLibraryVersion, Library.cache.version)

      io.to(sock.id).emit('action', {
        type: LIBRARY_PUSH,
        payload: Library.get(),
      })
    }

    // push user's stars
    io.to(sock.id).emit('action', {
      type: STARS_PUSH,
      payload: Library.getUserStars(sock.user.userId),
    })

    // push star counts (only if client's is outdated)
    if (clientStarsVersion !== Library.starCountsCache.version) {
      log.verbose('pushing star counts to %s (%s) (client=%s, server=%s)',
        sock.user.name, sock.id, clientStarsVersion, Library.starCountsCache.version)

      io.to(sock.id).emit('action', {
        type: STAR_COUNTS_PUSH,
        payload: Library.getStarCounts(),
      })
    }

    // it's possible for an admin to not be in a room
    if (typeof sock.user.roomId !== 'number') return

    // beyond this point assumes there is a room

    // add user to room and track membership
    sock.join(Rooms.prefix(sock.user.roomId))
    Rooms.trackUser(sock.user.roomId, sock.user.userId)

    // if there's a player in room, emit its last known status
    // @todo this just emits the first status found
    for (const s of io.of('/').sockets.values()) {
      if (s.user && s.user.roomId === sock.user.roomId && s._lastPlayerStatus) {
        io.to(sock.id).emit('action', {
          type: PLAYER_STATUS,
          payload: s._lastPlayerStatus,
        })

        break
      }
    }

    log.verbose('%s (%s) joined room %s (%s in room)',
      sock.user.name, sock.id, sock.user.roomId, sock.adapter.rooms.size,
    )

    // Where the room's transport is. Pushed on the way in as well as on every
    // change, because somebody who opens the app into a room that is already
    // paused never sees a change — and the library decides whether to offer
    // its songs from this.
    io.to(sock.id).emit('action', {
      type: ROOM_STATUS_PUSH,
      payload: {
        roomId: sock.user.roomId,
        status: Rooms.get(sock.user.roomId, { status: STATUSES })
          .entities[sock.user.roomId]?.status,
      },
    })

    // send room's queue
    io.to(sock.id).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })

    // A room whose queue predates trivia being switched on has no round waiting
    // in it; put one there rather than making someone queue a song first.
    Trivia.syncQueueAndPush(io, sock.user.roomId)

    // a guest who picked their phone up mid-question still gets to answer it
    const round = Trivia.getRound(sock.user.roomId)

    if (round) {
      io.to(sock.id).emit('action', {
        type: TRIVIA_ROUND,
        // re-stamped: this phone is meeting the round part-way through, and
        // its own clock offset has to be measured against now, not against
        // whenever the room first saw the question
        payload: { ...round, sentAt: Date.now() },
      })
    }

    // A challenge is only ever sent to the two phones it concerns, so a
    // fighter whose phone dropped and came back has no other way to get it —
    // and the other one is sitting there waiting on an answer that can no
    // longer be given.
    const invite = Battle.getInvite(sock.user.roomId)

    if (invite && (invite.challengerUserId === sock.user.userId || invite.opponentUserId === sock.user.userId)) {
      io.to(sock.id).emit('action', {
        type: BATTLE_INVITE,
        payload: invite,
      })
    }

    // and anyone joining mid-battle gets the beat in play, re-stamped for the
    // same reason the round above is: this client is meeting the beat
    // part-way through and has to measure its own clock against now
    const turn = Battle.getTurn(sock.user.roomId)

    if (turn) {
      io.to(sock.id).emit('action', {
        type: BATTLE_TURN,
        payload: { ...turn, sentAt: Date.now() },
      })
    }
  })
}
