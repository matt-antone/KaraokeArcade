import type { RootState } from 'store/store'
import { ensureState } from 'redux-optimistic-ui'
import { createSelector } from '@reduxjs/toolkit'
import getMyUpcoming from './getMyUpcoming'
import getPlayerHistory from './getPlayerHistory'
import { dealQueue } from './getRoundRobinQueue'

const getResult = (state: RootState) => ensureState(state.queue).result
const getEntities = (state: RootState) => ensureState(state.queue).entities
const getQueueId = (state: RootState) => state.status.queueId
const getNextUserId = (state: RootState) => state.status.nextUserId
const getPausedUserIds = (state: RootState) => ensureState(state.queue).pausedUserIds
const getUserId = (state: RootState) => state.user.userId

/**
 * What the Queue screen lists: the turns still to come, never the song on
 * stage (that is the banner's).
 *
 * `upcoming` deals the rotation as if the viewer were not paused, so their
 * held songs sit at the places they keep (07c) and the row reads Hold. Display
 * only: the real rotation, getRoundRobinQueue, leaves a paused singer out, and
 * the waits come from that.
 */
const getQueueDisplay = createSelector(
  [getResult, getEntities, getPlayerHistory, getQueueId, getNextUserId, getPausedUserIds, getUserId, getMyUpcoming],
  (result, entities, history, curId, nextUserId, pausedUserIds, userId, mine) => {
    const others = pausedUserIds.filter(id => id !== userId)
    const isWaiting = (qId: number) => qId !== curId && !history.includes(qId)

    return {
      upcoming: dealQueue(result, entities, history, curId, nextUserId, others).result.filter(isWaiting),
      mine: mine.filter(isWaiting),
    }
  },
)

export default getQueueDisplay
