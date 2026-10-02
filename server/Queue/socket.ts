import Queue from './Queue.js'
import Rooms from '../Rooms/Rooms.js'
import Party from '../Party/Party.js'
import { QUEUE_ADD, QUEUE_MOVE, QUEUE_PAUSE, QUEUE_REMOVE, QUEUE_SET_KEY, QUEUE_PUSH } from '../../shared/actionTypes.js'

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  [QUEUE_ADD]: async (sock, { payload }, acknowledge) => {
    const { songId } = payload

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false })
    } catch (err) {
      return acknowledge({
        type: QUEUE_ADD + '_ERROR',
        error: err.message,
      })
    }

    Queue.add({
      roomId: sock.user.roomId,
      songId,
      userId: sock.user.userId,
    })

    // Keep one alternating room game in the singer rotation.
    Party.syncQueue(sock.server, sock.user.roomId)

    // success
    acknowledge({ type: QUEUE_ADD + '_SUCCESS' })

    // to all in room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
  [QUEUE_MOVE]: async (sock, { payload }, acknowledge) => {
    const { queueId, prevQueueId } = payload

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false })
    } catch (err) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: err.message,
      })
    }

    if (!sock.user.isAdmin && !(Queue.isOwner(sock.user.userId, queueId))) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: 'Cannot move another user\'s song',
      })
    }

    Queue.move({
      prevQueueId,
      queueId,
      roomId: sock.user.roomId,
    })

    // success
    acknowledge({ type: QUEUE_MOVE + '_SUCCESS' })

    // tell room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
  [QUEUE_PAUSE]: (sock, { payload }, acknowledge) => {
    const { isPaused, userId = sock.user.userId } = payload

    if (userId !== sock.user.userId && !sock.user.isAdmin) {
      return acknowledge({
        type: QUEUE_PAUSE + '_ERROR',
        error: 'Cannot pause another user\'s songs',
      })
    }

    Queue.setPaused({
      isPaused: !!isPaused,
      roomId: sock.user.roomId,
      userId,
    })

    // success
    acknowledge({ type: QUEUE_PAUSE + '_SUCCESS' })

    // tell room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
  [QUEUE_SET_KEY]: (sock, { payload }, acknowledge) => {
    const { keyChange, queueId } = payload

    // same rule as moving: your own song, or you're the admin. Clamping lives
    // in Queue.setKeyChange so a payload can't store a key the player would
    // then refuse to shift to.
    if (!sock.user.isAdmin && !(Queue.isOwner(sock.user.userId, queueId))) {
      return acknowledge({
        type: QUEUE_SET_KEY + '_ERROR',
        error: 'Cannot set the key of another user\'s song',
      })
    }

    Queue.setKeyChange({ keyChange, queueId })

    // success
    acknowledge({ type: QUEUE_SET_KEY + '_SUCCESS' })

    // tell room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
  [QUEUE_REMOVE]: (sock, { payload }, acknowledge) => {
    const { queueId } = payload
    const ids = Array.isArray(queueId) ? queueId : [queueId]

    if (!sock.user.isAdmin && !(Queue.isOwner(sock.user.userId, ids))) {
      return acknowledge({
        type: QUEUE_REMOVE + '_ERROR',
        error: 'Cannot remove another user\'s song',
      })
    }

    for (const id of ids) {
      Queue.remove(id)
    }

    // success
    acknowledge({ type: QUEUE_REMOVE + '_SUCCESS' })

    // tell room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
}

export default ACTION_HANDLERS
