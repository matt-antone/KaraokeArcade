import KoaRouter from '@koa/router'
import { requireAdmin } from '../lib/util.js'
import sql from 'sqlate'
import { db } from '../lib/Database.js'
import getLogger from '../lib/Log.js'
import Rooms, { STATUSES } from '../Rooms/Rooms.js'
import setRoomTransport from './transport.js'
import Battle from '../Battle/Battle.js'
import Trivia from '../Trivia/Trivia.js'
import { ValidationError } from '../lib/Errors.js'

interface RequestWithBody {
  body: Record<string, unknown>
}

const log = getLogger('Rooms')
const router = new KoaRouter({ prefix: '/api/rooms' })

import { ROOM_PREFS_PUSH } from '../../shared/actionTypes.js'
import publicRoomPrefs from './publicPrefs.js'

// list rooms
router.get(['/', '/:roomId'], (ctx) => {
  const roomId = ctx.params.roomId ? parseInt(ctx.params.roomId, 10) : undefined
  // Admins see every room so they can work the transport. Everyone else sees
  // only playing rooms — that list is the one they pick a room to join from —
  // plus the room they are already in, whatever its transport: a paused room
  // still has a player asking for its own prefs, and dropping it there blanks
  // the QR and trivia settings mid-night.
  const isOwnRoom = typeof roomId === 'number' && roomId === ctx.user.roomId
  const status = ctx.user.isAdmin || isOwnRoom ? STATUSES : undefined
  const res = Rooms.get(roomId, { status })

  res.result.forEach((roomId) => {
    if (ctx.user.isAdmin) {
      const room = ctx.io.sockets.adapter.rooms.get(Rooms.prefix(roomId))
      res.entities[roomId].numUsers = room ? room.size : 0
    } else {
      res.entities[roomId].prefs = publicRoomPrefs(res.entities[roomId].prefs)
    }
  })

  ctx.body = res
})

// create room
router.post('/', requireAdmin, async (ctx) => {
  try {
    const res = await Rooms.set(undefined, (ctx.request as unknown as RequestWithBody).body)
    log.verbose('%s created a room (roomId: %s)', ctx.user.name, res.lastID)
  } catch (err) {
    if (err instanceof ValidationError) ctx.throw(422, err.message)
    throw err
  }

  // send updated room list
  ctx.body = Rooms.get(null, { status: STATUSES })
})

// update room
router.put('/:roomId', requireAdmin, async (ctx) => {
  const roomId = parseInt(ctx.params.roomId, 10)

  try {
    await Rooms.set(roomId, (ctx.request as unknown as RequestWithBody).body)
  } catch (err) {
    if (err instanceof ValidationError) ctx.throw(422, err.message)
    throw err
  }

  log.verbose('%s updated a room (roomId: %s)', ctx.user.name, roomId)

  // trivia may have just been switched on or off, which adds or removes the
  // round waiting in the queue. Pushes the queue only if it actually changed.
  Trivia.syncQueueAndPush(ctx.io, roomId)

  const sockets = await ctx.io.in(Rooms.prefix(roomId)).fetchSockets()

  for (const s of sockets) {
    if (s?.user.isAdmin) {
      ctx.io.to(s.id).emit('action', {
        type: ROOM_PREFS_PUSH,
        payload: Rooms.get(roomId),
      })
    }
  }

  // send updated room list
  ctx.body = Rooms.get(null, { status: STATUSES })
})

// move a room's transport
//
// Separate from the edit form's PUT because the transitions do work no form
// save can: pausing and stopping have to reach the running player, and stopping
// empties the room. Routed over HTTP rather than the socket so it answers with
// the same room list every other write here does, and the client reduces it
// without a second round trip.
router.post('/:roomId/status', requireAdmin, (ctx) => {
  const roomId = parseInt(ctx.params.roomId, 10)
  const { status } = (ctx.request as unknown as RequestWithBody).body

  if (!Number.isInteger(roomId)) ctx.throw(422, 'Invalid roomId')

  try {
    setRoomTransport(ctx.io, roomId, status as string)
  } catch (err) {
    if (err instanceof ValidationError) ctx.throw(422, err.message)
    throw err
  }

  log.verbose('%s set roomId %s to %s', ctx.user.name, roomId, status)

  // send updated room list
  ctx.body = Rooms.get(null, { status: STATUSES })
})

// remove room
router.delete('/:roomId', requireAdmin, (ctx) => {
  const roomId = parseInt(ctx.params.roomId, 10)

  if (typeof roomId !== 'number') {
    ctx.throw(422, 'Invalid roomId')
  }

  // remove room's queue first
  const queueQuery = sql`
    DELETE FROM queue
    WHERE roomId = ${roomId}
  `
  db.run(String(queueQuery), queueQuery.parameters)

  // and its trivia scores, which also reference the room: leaving them would
  // fail the foreign key on the delete below rather than orphan quietly
  const scoresQuery = sql`
    DELETE FROM triviaScores
    WHERE roomId = ${roomId}
  `
  db.run(String(scoresQuery), scoresQuery.parameters)

  Trivia.stopRoom(roomId)

  // same for a battle: its beats are on setTimeout and the room they emit into
  // is about to stop existing
  Battle.stopRoom(roomId)

  // remove room
  const roomQuery = sql`
    DELETE FROM rooms
    WHERE roomId = ${roomId}
  `
  db.run(String(roomQuery), roomQuery.parameters)

  log.verbose('%s deleted roomId %s', ctx.user.name, roomId)

  // send updated room list
  ctx.body = Rooms.get(null, { status: STATUSES })
})

export default router
