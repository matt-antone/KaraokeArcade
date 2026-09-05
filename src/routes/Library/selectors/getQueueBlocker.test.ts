import { describe, expect, it } from 'vitest'
import getQueueBlocker from './getQueueBlocker'
import type { RootState } from 'store/store'

/**
 * The library asks this before it offers a song, and the answer decides
 * whether three hundred rows go inert. Being wrong in the permissive direction
 * costs a refusal after a tap, which is what happened before this existed;
 * being wrong the other way greys out a working library, which is worse. The
 * unknown case is the one that matters most here.
 */
const state = (roomId: number | null, myRoomStatus: string | null) => ({
  user: { roomId },
  rooms: { myRoomStatus },
} as unknown as RootState)

describe('getQueueBlocker', () => {
  it('lets a playing room through', () => {
    expect(getQueueBlocker(state(9, 'play'))).toBeNull()
  })

  it('names having no room at all', () => {
    // an admin may sign in without choosing one
    expect(getQueueBlocker(state(null, 'play'))).toBe('You\'re not in a room')
  })

  it('names a paused room', () => {
    expect(getQueueBlocker(state(9, 'paused'))).toBe('This room is paused')
  })

  it('names a stopped room', () => {
    expect(getQueueBlocker(state(9, 'stopped'))).toBe('This room is closed')
  })

  // the status arrives on connect and on every transport change, so there is a
  // moment before the first one lands — and a client that somehow never hears
  // must not be left staring at a dead library
  it('allows queueing while the status is still unknown', () => {
    expect(getQueueBlocker(state(9, null))).toBeNull()
  })
})
