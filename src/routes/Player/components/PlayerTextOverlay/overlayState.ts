import type { QueueItem } from 'shared/types'

/** Five mutually exclusive states — never two at once. */
type OverlayState = 'playing' | 'intermission' | 'idle' | 'empty' | 'errored'

/**
 * Which of the five states the stage is in. Its own function because it is a
 * priority ladder — the earlier tests win — and a ladder is much easier to
 * check for holes when it is not interleaved with the markup for its own
 * outcomes.
 */
const overlayState = ({ isQueueEmpty, isAtQueueEnd, nextQueueItem, queueItem, isErrored, intermissionEndsAt }: {
  isQueueEmpty: boolean
  isAtQueueEnd: boolean
  nextQueueItem?: QueueItem
  queueItem?: QueueItem
  isErrored: boolean
  intermissionEndsAt?: number
}): OverlayState => {
  if (isQueueEmpty || (isAtQueueEnd && !nextQueueItem)) return 'empty'
  if (!queueItem || (isAtQueueEnd && nextQueueItem)) return 'idle'
  if (isErrored) return 'errored'
  if (intermissionEndsAt) return 'intermission'

  return 'playing'
}

export default overlayState
