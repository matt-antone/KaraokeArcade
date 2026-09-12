import type { RootState } from 'store/store'
import { ensureState } from 'redux-optimistic-ui'
import { createSelector } from '@reduxjs/toolkit'
import type { QueueItem } from 'shared/types'
import getPlayerHistory from './getPlayerHistory'

const getResult = (state: RootState) => ensureState(state.queue).result
const getEntities = (state: RootState) => ensureState(state.queue).entities
const getQueueId = (state: RootState) => state.status.queueId
const getNextUserId = (state: RootState) => state.status.nextUserId
const getPausedUserIds = (state: RootState) => ensureState(state.queue).pausedUserIds

/**
 * The rows whose order is already settled: everything played, the row on stage,
 * and the next singer the player has locked in. Nothing here is re-ordered, so
 * the rotation below only ever arranges what is genuinely still upcoming.
 */
function getSettled (
  result: number[],
  entities: Record<number, QueueItem>,
  history: number[],
  curId: number,
  nextUserId: number | null,
  pausedUserIds: number[],
): number[] {
  // in case history references non-existent items or queue is still loading
  const settled = history.filter(queueId => result.includes(queueId))

  // consider current item played (don't re-order it)
  if (entities[curId] && settled.lastIndexOf(curId) === -1) {
    settled.push(curId)
  }

  if (nextUserId === null || pausedUserIds.includes(nextUserId)) return settled

  // "lock in" next user's item (don't re-order it)
  for (const queueId of result) {
    if (!settled.includes(queueId) && entities[queueId].isOptimistic !== true && entities[queueId].userId === nextUserId) {
      settled.push(queueId)
      break
    }
  }

  return settled
}

/**
 * Every row still waiting, grouped by singer and left in queue order within
 * each singer.
 *
 * A trivia round is spaced exactly as a singer is, under its own userId of
 * 0 — that is what "takes its turn in the rotation" means, and it is why
 * the round is not special-cased here at all.
 *
 * Parking it at the end instead looks right in a short queue and is wrong
 * in a real one: with fifteen songs waiting, the round sat an hour out and
 * the room would never have reached it. Spaced, it comes round once per
 * lap however deep the queue gets, and because it is the last row added it
 * loses the first-pass tie to every singer already waiting — so its first
 * turn is one full lap away rather than immediately.
 */
function groupBySinger (
  result: number[],
  entities: Record<number, QueueItem>,
  settled: number[],
  pausedUserIds: number[],
): Map<number, number[]> {
  const map = new Map<number, number[]>()

  for (const queueId of result) {
    const item = entities[queueId]

    if (settled.includes(queueId) // only concerned with upcoming songs
      || item.isOptimistic === true // ignore optimistic items
      || pausedUserIds.includes(item.userId) // singer is sitting out
      // A round the server has already asked is spent. Without this a player
      // that reloads has no memory of it, offers it a turn anyway, and the
      // room watches the intermission hand straight over to the next song.
      || item.isPlayed === true
    ) continue

    map.set(item.userId, [...(map.get(item.userId) ?? []), queueId])
  }

  return map
}

/** Whoever has waited longest since their last turn. Never sung this session
 *  counts as infinitely long ago, and ties fall to whoever the map reached
 *  first — which is queue order, so the newest row loses a first-pass tie. */
function longestWaiting (map: Map<number, number[]>, resultByUser: number[]): number {
  let max = -1
  let maxUserId = -1

  for (const userId of map.keys()) {
    const idx = resultByUser.lastIndexOf(userId)
    const distance = idx === -1 ? Infinity : resultByUser.length - idx

    if (distance > max) {
      max = distance
      maxUserId = userId
    }
  }

  return maxUserId
}

/** Deal one row at a time to whoever has waited longest, until nobody is left
 *  waiting. Each row dealt counts as that singer's turn for the next round. */
function dealRotation (map: Map<number, number[]>, resultByUser: number[]): number[] {
  const upcoming: number[] = []

  while (map.size) {
    const userId = longestWaiting(map, resultByUser)
    const userItems = map.get(userId) as number[]
    const queueId = userItems.shift() as number

    if (userItems.length) map.set(userId, userItems)
    else map.delete(userId)

    resultByUser.push(userId)
    upcoming.push(queueId)
  }

  return upcoming
}

const getRoundRobinQueue = createSelector(
  [getResult, getEntities, getPlayerHistory, getQueueId, getNextUserId, getPausedUserIds],
  (result, entities, history, curId, nextUserId, pausedUserIds) => {
    const settled = getSettled(result, entities, history, curId, nextUserId, pausedUserIds)
    const map = groupBySinger(result, entities, settled, pausedUserIds)
    // should be no optimistic items
    const resultByUser = settled.map(queueId => (entities[queueId] as QueueItem).userId)

    return {
      result: settled.concat(dealRotation(map, resultByUser)) as number[],
      entities: entities as Record<number, QueueItem>,
    }
  },
)

export default getRoundRobinQueue
