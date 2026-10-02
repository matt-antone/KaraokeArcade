import { isPartyItem } from 'shared/party'
import type { RootState } from 'store/store'
import { ensureState } from 'redux-optimistic-ui'
import { createSelector } from '@reduxjs/toolkit'
import { isBattleItem, isTriviaItem } from 'shared/types'
import getMyUpcoming from './getMyUpcoming'

const getEntities = (state: RootState) => ensureState(state.queue).entities

/**
 * The queue row the challenger is spending on a battle, or 0 if they have none.
 *
 * Throwing a challenge costs the challenger the turn they already had: the
 * server converts this exact row in place, so the battle keeps the slot in the
 * prevQueueId chain that the row had earned. That is the deal, and it is why
 * this is their *next* turn rather than their last — the fight should happen
 * while both fighters are still in the room.
 *
 * 0 means "I have nothing queued", and the server appends a fresh row at the
 * tail instead. 0 rather than null for the reason every other id on the wire
 * is 0 when absent: no queue row has id 0.
 *
 * Built on getMyUpcoming rather than re-walking the queue, so it inherits the
 * round-robin ordering and the played/paused filtering already worked out
 * there — including, now, battle rows the user is only the opponent in, which
 * fall out below because they are not type 'song'.
 */
const getBattleTargetQueueId = createSelector(
  [getMyUpcoming, getEntities],
  (upcoming, entities) => {
    for (const qId of upcoming) {
      const item = entities[qId]

      // An optimistic row has no server-side queueId to convert — the id it
      // carries was invented by the reducer and belongs to nothing. A trivia
      // round is nobody's turn to spend, and a row that is already a battle
      // cannot be spent twice.
      if (item.isOptimistic === true || (isTriviaItem(item) || isPartyItem(item)) || isBattleItem(item)) continue

      return qId
    }

    return 0
  },
)

export default getBattleTargetQueueId
