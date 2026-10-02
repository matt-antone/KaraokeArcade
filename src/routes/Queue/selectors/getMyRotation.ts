import { isPartyItem } from 'shared/party'
import type { RootState } from 'store/store'
import { createSelector } from '@reduxjs/toolkit'
import { isBattleItem, isTriviaItem } from 'shared/types'
import getRoundRobinQueue from './getRoundRobinQueue'

const getQueueId = (state: RootState) => state.status.queueId
const getUserId = (state: RootState) => state.user.userId

/**
 * Where this singer sits in the rotation, and how many singers are in it.
 *
 * The rotation is the set of *distinct singers* still to come, in the order
 * they will sing — not the queue of songs. Someone with three songs queued is
 * one place in the rotation, not three, which is what "2 of 4" has to mean for
 * the header to answer "when am I on".
 *
 * getRoundRobinQueue has already ordered the queue and dropped anyone sitting
 * out, so walking it forward from the current song gives that order directly.
 *
 * position is 1-based, or 0 when this singer has nothing coming up.
 */
const getMyRotation = createSelector(
  [getRoundRobinQueue, getQueueId, getUserId],
  (queue, queueId, userId) => {
    const { result, entities } = queue
    const order: number[] = []

    // indexOf returns -1 when nothing is playing, so this starts at 0 and walks
    // the whole queue — which is what we want before the first song starts
    for (const qId of result.slice(result.indexOf(queueId) + 1)) {
      // a trivia round takes a turn but is nobody's turn: counting it would
      // make the rotation one longer than the number of singers in it
      if ((isTriviaItem(entities[qId]) || isPartyItem(entities[qId]))) continue

      const singer = entities[qId]?.userId
      if (singer !== undefined && !order.includes(singer)) order.push(singer)

      // A battle is two people's turn, and the opponent's only one. Counting
      // just the challenger — whose id is the row's userId — tells an opponent
      // with no song of their own that they have nothing coming up, which is
      // the "0" the header reads as "you are not in the rotation", while they
      // are in fact next up at the microphone. They go in after the
      // challenger because the challenger sings first.
      if (!isBattleItem(entities[qId])) continue

      const opponent = entities[qId].opponentUserId
      if (opponent && !order.includes(opponent)) order.push(opponent)
    }

    return {
      position: order.indexOf(userId) + 1,
      rotationSize: order.length,
    }
  },
)

export default getMyRotation
