import { describe, expect, it } from 'vitest'
import type { RoomSinger } from 'shared/types'
import { BATTLE_SINGERS } from 'lib/battleSingers'
import { CROWD_MAX, crowdOf, joinCountOf, seatsFor, type Seats } from './crowd'

const room = (n: number, from = 1): RoomSinger[] =>
  Array.from({ length: n }, (_, i) => ({ userId: from + i, avatarId: BATTLE_SINGERS[i % 8].id }))

/** userId per spot, null for empty, with a leaver marked `~id`. */
const who = (seats: Seats) => seats.map(s => (s ? (s.isHere ? s.userId : `~${s.userId}`) : null))

describe('seatsFor', () => {
  it('seats the room front row first, in the order they came in', () => {
    const seats = seatsFor([], room(6))

    expect(seats).toHaveLength(CROWD_MAX)
    expect(who(seats).slice(0, 7)).toEqual([1, 2, 3, 4, 5, 6, null])
  })

  it('moves nobody when somebody joins', () => {
    const before = seatsFor([], room(5))
    // the newcomer arrives first in the list: order in the push is not a seat
    const after = seatsFor(before, [{ userId: 99, avatarId: null }, ...room(5)])

    expect(who(after).slice(0, 6)).toEqual([1, 2, 3, 4, 5, 99])
  })

  it('keeps a leaver\'s spot for them, and hands it to the next newcomer', () => {
    const five = seatsFor([], room(5))
    const left = seatsFor(five, room(5).filter(s => s.userId !== 2))

    expect(who(left).slice(0, 5)).toEqual([1, '~2', 3, 4, 5])

    // back again: same spot
    expect(who(seatsFor(left, room(5))).slice(0, 5)).toEqual([1, 2, 3, 4, 5])

    // somebody new instead: the frontmost free spot is the one 2 left
    const taken = seatsFor(left, [...room(5).filter(s => s.userId !== 2), { userId: 42, avatarId: null }])
    expect(who(taken).slice(0, 6)).toEqual([1, 42, 3, 4, 5, null])
  })

  it('stands still for the same room', () => {
    const seats = seatsFor([], room(12))

    expect(seatsFor(seats, room(12))).toEqual(seats)
  })

  it('takes a changed fighter without moving them', () => {
    const seats = seatsFor([], room(3))
    const after = seatsFor(seats, room(3).map(s => (s.userId === 2 ? { ...s, avatarId: 'halloween/deb' } : s)))

    expect(after[1]).toEqual({ userId: 2, avatarId: 'halloween/deb', isHere: true })
  })

  it('seats forty and no more; the forty-first waits for a spot', () => {
    const full = seatsFor([], room(41))

    expect(full.every(s => s?.isHere)).toBe(true)
    expect(full.some(s => s?.userId === 41)).toBe(false)

    const gone = seatsFor(full, room(41).filter(s => s.userId !== 10))
    expect(gone[9]).toEqual({ ...room(41)[40], isHere: true })
  })
})

describe('crowdOf', () => {
  it('draws each person as their own fighter, the default for nobody picked', () => {
    const crowd = crowdOf(seatsFor([], [
      { userId: 1, avatarId: 'p5' },
      { userId: 2, avatarId: 'halloween/deb' },
      { userId: 3, avatarId: null },
      { userId: 4, avatarId: 'not a/valid/id' },
    ]))

    expect(crowd.map(m => m.singer.id)).toEqual(['p5', 'halloween/deb', BATTLE_SINGERS[0].id, BATTLE_SINGERS[0].id])
  })

  it('draws only the spots somebody holds, leavers included so they can fade', () => {
    const seats = seatsFor(seatsFor([], room(3)), room(3).slice(1))
    const crowd = crowdOf(seats)

    expect(crowd.map(m => [m.seat, m.isHere])).toEqual([[0, false], [1, true], [2, true]])
    expect(crowdOf(seatsFor([], []))).toEqual([])
  })

  it('stands ten rows of four, front to back', () => {
    const crowd = crowdOf(seatsFor([], room(40)))
    const perRow = crowd.reduce<Record<number, number>>((acc, m) => ({ ...acc, [m.row]: (acc[m.row] ?? 0) + 1 }), {})

    expect(Object.keys(perRow)).toHaveLength(10)
    expect(Object.values(perRow).every(n => n === 4)).toBe(true)
    expect(crowd.slice(0, 4).every(m => m.row === 0)).toBe(true)
  })

  it('puts a spot in the same place whoever holds it', () => {
    const a = crowdOf(seatsFor([], room(8))).map(m => [m.row, m.x])
    const b = crowdOf(seatsFor([], room(8, 100))).map(m => [m.row, m.x])

    expect(a).toEqual(b)
  })
})

describe('joinCountOf', () => {
  it('says the room in the design\'s words, capped at forty like the crowd', () => {
    expect(joinCountOf(0)).toBe('Waiting for singers')
    expect(joinCountOf(1)).toBe('1 singer in')
    expect(joinCountOf(39)).toBe('39 singers in')
    expect(joinCountOf(46)).toBe('40 singers in')
  })
})
