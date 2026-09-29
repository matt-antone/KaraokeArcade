import { describe, it, expect } from 'vitest'
import getQueueDisplay from './getQueueDisplay'

// alice (1) queued 3 songs before bob (2) queued 2
const ENTITIES = {
  1: { queueId: 1, songId: 10, userId: 1, prevQueueId: null as number | null },
  2: { queueId: 2, songId: 11, userId: 1, prevQueueId: 1 },
  3: { queueId: 3, songId: 12, userId: 1, prevQueueId: 2 },
  4: { queueId: 4, songId: 13, userId: 2, prevQueueId: 3 },
  5: { queueId: 5, songId: 14, userId: 2, prevQueueId: 4 },
}

const state = ({ history = [], queueId = null, pausedUserIds = [], userId = 1 }: {
  history?: number[]
  queueId?: number | null
  pausedUserIds?: number[]
  userId?: number
} = {}) => ({
  queue: { isLoading: false, result: [1, 2, 3, 4, 5], entities: ENTITIES, pausedUserIds },
  status: { historyJSON: JSON.stringify(history), queueId, isAtQueueEnd: false, nextUserId: null },
  user: { userId },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any

describe('getQueueDisplay', () => {
  it('lists the turns still to come, never the song on stage', () => {
    expect(getQueueDisplay(state({ history: [1], queueId: 1 })))
      .toEqual({ upcoming: [4, 2, 5, 3], mine: [2, 3] })
  })

  it('keeps my held songs at their places while I am paused (07c)', () => {
    expect(getQueueDisplay(state({ history: [1], queueId: 1, pausedUserIds: [1] })))
      .toEqual({ upcoming: [4, 2, 5, 3], mine: [2, 3] })
  })

  it('still leaves out somebody else who has paused', () => {
    expect(getQueueDisplay(state({ history: [1], queueId: 1, pausedUserIds: [2] })).upcoming)
      .toEqual([2, 3])
  })
})
