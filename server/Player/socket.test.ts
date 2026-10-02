vi.mock('../Party/Party.js', () => ({ default: { sync: vi.fn() } }))
import { describe, it, expect, vi } from 'vitest'
import handlers from './socket.js'
import { PLAYER_EMIT_LEAVE, PLAYER_EMIT_STATUS, PLAYER_STATUS, ROOM_SINGERS_PUSH } from '../../shared/actionTypes.js'

/**
 * The TV's socket is in the room like any phone until it starts reporting a
 * status, so the room's singer count has to be re-sent on that edge (and when
 * it stops being the player) or the TV counts itself in the crowd.
 */
describe('the player socket and the singer count', () => {
  const setup = () => {
    const emitted: { type: string, payload?: unknown }[] = []
    const phone = { id: 'phone', user: { userId: 1, roomId: 1 } }
    const tv = { id: 'tv', user: { userId: 2, roomId: 1 }, _lastPlayerStatus: null as unknown }
    const server = {
      of: () => ({ sockets: new Map([['phone', phone], ['tv', tv]]) }),
      to: () => ({ emit: (_e: string, a: { type: string, payload?: unknown }) => emitted.push(a) }),
    }

    return { emitted, tv: Object.assign(tv, { server }) }
  }

  const counts = (emitted: { type: string, payload?: unknown }[]) =>
    emitted.filter(e => e.type === ROOM_SINGERS_PUSH).map(e => (e.payload as { count: number }).count)

  it('takes the TV out of the count on its first status, and only then', () => {
    const { emitted, tv } = setup()

    handlers[PLAYER_EMIT_STATUS](tv, { payload: { isPlaying: false } })
    handlers[PLAYER_EMIT_STATUS](tv, { payload: { isPlaying: false } })

    expect(counts(emitted)).toEqual([1])
  })

  it('counts it again once it leaves the player', () => {
    const { emitted, tv } = setup()

    handlers[PLAYER_EMIT_STATUS](tv, { payload: { isPlaying: false } })
    handlers[PLAYER_EMIT_LEAVE](tv)

    expect(counts(emitted)).toEqual([1, 2])
  })

  /** 12e0: the TV's lead-in end is by its own clock, which can be minutes out.
   *  The phones get it by ours, stamped, so serverNow can read it. */
  it('rebases the lead-in onto the server\'s clock and stamps the status', () => {
    const { emitted, tv } = setup()
    const skew = 60 * 60 * 1000

    handlers[PLAYER_EMIT_STATUS](tv, { payload: { isPlaying: false, leadInEndsAt: Date.now() + skew + 7500, sentAt: Date.now() + skew } })

    const status = emitted.find(e => e.type === PLAYER_STATUS)!.payload as { leadInEndsAt: number, sentAt: number }
    expect(Math.abs(status.sentAt - Date.now())).toBeLessThan(1000)
    expect(Math.abs(status.leadInEndsAt - (Date.now() + 7500))).toBeLessThan(1000)
  })
})
