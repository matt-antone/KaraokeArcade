import type { RootState } from 'store/store'
import { ensureState } from 'redux-optimistic-ui'
import { createSelector } from '@reduxjs/toolkit'
import { rotationIdOf, type OptimisticQueueItem, type QueueItem } from 'shared/types'
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
  entities: Record<number, QueueItem | OptimisticQueueItem>,
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

  /* "lock in" next user's item (don't re-order it).
     On the rotation id, not the raw userId, and both sides of this have to
     agree or the lock pins the wrong row. A battle's userId is the
     challenger's, so matching on it finds one of the challenger's own *songs*
     in raw queue order and pins that ahead of the fight — which then slips one
     slot every time the player advances and ends up last in the queue, the
     exact outcome groupBySinger refuses below. PlayerController stores
     rotationIdOf for the same reason. */
  for (const queueId of result) {
    if (!settled.includes(queueId) && entities[queueId].isOptimistic !== true && rotationIdOf(entities[queueId]) === nextUserId) {
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
 * Grouped by whoever the row takes its turn *as* — rotationIdOf, not userId.
 * For a song those are the same person. A trivia round and a singer battle are
 * the room's turn rather than anyone's, and each is dealt under its own
 * reserved id (shared/types.ts), so both are spaced exactly as a singer is.
 *
 * Parking either at the end instead looks right in a short queue and is wrong
 * in a real one: with fifteen songs waiting, the round sat an hour out and
 * the room would never have reached it. Spaced, it comes round once per
 * lap however deep the queue gets, and because it is the last row added it
 * loses the first-pass tie to every singer already waiting — so its first
 * turn is one full lap away rather than immediately.
 *
 * A battle matters more than a round here, because its row carries a real
 * userId. Dealt on that, the fight spends the challenger's turn and buys the
 * opponent a free one — they sing the battle, are still recorded as never
 * having sung, and the rotation gives them their own song next. Dealt under
 * the reserved id, the fight is its own participant and neither fighter's
 * place in the rotation is touched by having been in it.
 */
function groupBySinger (
  result: number[],
  entities: Record<number, QueueItem | OptimisticQueueItem>,
  settled: number[],
  pausedUserIds: number[],
): Map<number, number[]> {
  const map = new Map<number, number[]>()

  for (const queueId of result) {
    const item = entities[queueId]

    if (settled.includes(queueId) // only concerned with upcoming songs
      || item.isOptimistic === true // ignore optimistic items
      // On the real singer, not the reserved id a battle is dealt under: a
      // reserved id is nobody and can never be paused, and a challenger who
      // has sat down takes their fight with them.
      //
      // Only the challenger, though. A battle whose *opponent* has paused
      // stays in the rotation and will run, and the server never reads pauses
      // at all — so the second half hands the microphone to somebody who sat
      // down. Longstanding, not introduced with the reserved id, and left
      // alone here because what a pause should mean for a fight somebody else
      // arranged is a product question rather than a bug in this selector.
      || pausedUserIds.includes(item.userId)
      // A round the server has already asked is spent. Without this a player
      // that reloads has no memory of it, offers it a turn anyway, and the
      // room watches the intermission hand straight over to the next song.
      || item.isPlayed === true
    ) continue

    const dealAs = rotationIdOf(item)

    map.set(dealAs, [...(map.get(dealAs) ?? []), queueId])
  }

  return map
}

/** Whoever has waited longest since their last turn. Never sung this session
 *  counts as infinitely long ago, and ties fall to whoever the map reached
 *  first — which is queue order, so the newest row loses a first-pass tie. */
function longestWaiting (map: Map<number, number[]>, resultByUser: number[]): number {
  // Seeded from the first key rather than from -1: that used to be a value no
  // map could hold, and BATTLE_ROTATION_ID is now exactly -1. The seed is safe
  // because dealRotation only asks while the map is non-empty.
  let max = -1
  let maxUserId = map.keys().next().value as number

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

    // the key the row was grouped under is already its rotation id
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
    // Nothing settled can be optimistic: an optimistic row is appended to the
    // end of the queue and has never been played, so it reaches neither the
    // play history nor the playing row, and the "lock in next singer" pass
    // above skips it explicitly. Without the assertion this reads the rotation
    // id off a row type that has no userId.
    const resultByUser = settled.map(queueId => rotationIdOf(entities[queueId] as QueueItem))

    return {
      result: settled.concat(dealRotation(map, resultByUser)) as number[],
      entities: entities as Record<number, QueueItem>,
    }
  },
)

export default getRoundRobinQueue
