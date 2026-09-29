import { isBattleItem, type QueueItem } from 'shared/types'

/** Six mutually exclusive states — never two at once. */
type OverlayState = 'upNow' | 'upNextTease' | 'intermission' | 'idle' | 'empty' | 'errored'

/**
 * Which of the six states the stage is in. Its own function because it is a
 * priority ladder — the earlier tests win — and a ladder is much easier to
 * check for holes when it is not interleaved with the markup for its own
 * outcomes.
 */
const overlayState = ({ isQueueEmpty, isAtQueueEnd, nextQueueItem, queueItem, isErrored, intermissionEndsAt, isSongEnding }: {
  isQueueEmpty: boolean
  isAtQueueEnd: boolean
  nextQueueItem?: QueueItem
  queueItem?: QueueItem
  isErrored: boolean
  intermissionEndsAt?: number
  isSongEnding: boolean
}): OverlayState => {
  if (isQueueEmpty || (isAtQueueEnd && !nextQueueItem)) return 'empty'
  if (!queueItem || (isAtQueueEnd && nextQueueItem)) return 'idle'
  if (isErrored) return 'errored'
  if (intermissionEndsAt) return 'intermission'
  // Not before a battle: the corner panel names one singer, and a battle is two
  // of them. The stage is about to draw the pair properly.
  if (isSongEnding && nextQueueItem && !isBattleItem(nextQueueItem)) return 'upNextTease'

  return 'upNow'
}

export default overlayState
