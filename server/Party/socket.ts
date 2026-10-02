import Party from './Party.js'
import Rooms from '../Rooms/Rooms.js'
import Queue from '../Queue/Queue.js'
import { PARTY_REQUEST } from '../../shared/party.js'
import { QUEUE_PUSH } from '../../shared/actionTypes.js'

export default {
  [PARTY_REQUEST]: async (sock, { payload }, acknowledge) => {
    const { roomId, userId, isAdmin } = sock.user
    const { operation, queueId } = payload ?? {}
    await Rooms.validate(roomId, undefined, { validatePassword: false })
    let resolvedQueueId: number | undefined
    if (operation === 'start' || operation === 'end') {
      if (!isAdmin) throw new Error('Only the room player can control a round')
      if (operation === 'start' && !await Party.start(sock.server, roomId, queueId)) resolvedQueueId = queueId
      if (operation === 'end') Party.finish(sock.server, roomId)
    } else if (operation === 'answer') Party.answer(sock.server, roomId, userId, payload.id, payload.index)
    else if (operation === 'dismiss') Party.dismiss(roomId, userId, payload.id)
    else if (['draw', 'reroll', 'decline'].includes(operation)) {
      if (Rooms.getPlayerHistory(sock.server, roomId).includes(queueId)) throw new Error('This turn has already played')
      for (const client of sock.server.of('/').sockets.values()) {
        if (client.user?.roomId === roomId && client._lastPlayerStatus?.queueId === queueId) throw new Error('Choose roulette before your turn starts')
      }
      Party.roulette(roomId, userId, queueId, operation, payload.filters)
      sock.server.to(Rooms.prefix(roomId)).emit('action', { type: QUEUE_PUSH, payload: Queue.get(roomId) })
    } else if (operation !== 'refresh') throw new Error('Unknown party action')
    Party.push(sock.server, roomId)
    acknowledge({ type: PARTY_REQUEST + '_SUCCESS', payload: { ...Party.state(roomId, userId, isAdmin), resolvedQueueId } })
  },
}
