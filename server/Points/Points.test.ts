import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, open, close } from '../lib/Database.js'
import Points from './Points.js'
import { POINTS_PUSH } from '../../shared/actionTypes.js'

/**
 * Tonight's board is a total per person plus where it came from (023), and
 * everyone who joins the room is on it from the start, at 0.
 */

const ROOM_ID = 1
const ALICE = 1
const BOB = 2

const user = (userId: number, name: string) =>
  db.run(`INSERT INTO users (userId, username, password, name, roleId)
    VALUES (?, ?, 'x', ?, (SELECT roleId FROM roles WHERE name = 'standard'))`, [userId, name.toLowerCase(), name])

const entry = (userId: number) => Points.get(ROOM_ID).find(e => e.userId === userId)

describe('the night\'s ledger', () => {
  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })
    db.run('INSERT INTO rooms (roomId, name, status) VALUES (?, ?, ?)', [ROOM_ID, 'Room', 'play'])
    user(ALICE, 'Alice')
    user(BOB, 'Bob')
  })

  afterEach(close)

  it('counts each kind of payment in its own column beside the total', () => {
    Points.add(ROOM_ID, ALICE, 150, 'sing')
    Points.add(ROOM_ID, ALICE, 150, 'sing')
    Points.add(ROOM_ID, ALICE, 1000, 'battleWin')
    Points.add(ROOM_ID, ALICE, 250, 'battlePlay')
    Points.add(ROOM_ID, ALICE, 200, 'trivia')
    Points.add(ROOM_ID, ALICE, 500, 'trivia')
    Points.addTriviaRound(ROOM_ID, ALICE)

    // songs, battles and rounds count events; trivia's column is the points
    // it paid, so the 08 ledger reads "1 rounds = 700"
    expect(entry(ALICE)).toEqual({
      userId: ALICE,
      name: 'Alice',
      avatarId: null,
      points: 2250,
      sings: 2,
      battleWins: 1,
      battlePlays: 1,
      triviaPoints: 700,
      triviaRounds: 1,
    })
  })

  it('counts a round played even when it paid nothing', () => {
    Points.add(ROOM_ID, BOB, 0, 'trivia')
    Points.addTriviaRound(ROOM_ID, BOB)

    expect(entry(BOB)).toMatchObject({ points: 0, triviaPoints: 0, triviaRounds: 1 })
  })

  it('puts a singer on the board at 0 as they join, once', () => {
    expect(Points.join(ROOM_ID, BOB)).toBe(true)
    expect(entry(BOB)).toMatchObject({ points: 0, sings: 0 })

    // a second phone, or a reconnect, is not news and changes nothing
    Points.add(ROOM_ID, BOB, 150, 'sing')
    expect(Points.join(ROOM_ID, BOB)).toBe(false)
    expect(entry(BOB)?.points).toBe(150)
  })

  it('pays nobody, and never throws, for a session whose room or account is gone', () => {
    // a JWT outlives both deletes; a foreign-key throw from the connect
    // handler or a battle's timer is uncaught and shuts the server down
    expect(Points.join(ROOM_ID, 999)).toBe(false)
    expect(Points.join(42, ALICE)).toBe(false)
    expect(() => Points.add(ROOM_ID, 999, 1000, 'battleWin')).not.toThrow()
    expect(() => Points.addTriviaRound(42, ALICE)).not.toThrow()

    expect(Points.get(ROOM_ID)).toEqual([])
  })

  it('lists the whole room, best first and then by name', () => {
    Points.join(ROOM_ID, BOB)
    Points.join(ROOM_ID, ALICE)

    expect(Points.get(ROOM_ID).map(e => e.name)).toEqual(['Alice', 'Bob'])

    Points.add(ROOM_ID, BOB, 150, 'sing')
    expect(Points.get(ROOM_ID).map(e => e.name)).toEqual(['Bob', 'Alice'])
  })

  it('pushes the whole board, ledger and all', () => {
    const emitted: { target: string, type: string, payload: unknown }[] = []
    const io = { to: (target: string) => ({ emit: (_e: string, a: { type: string, payload: unknown }) => emitted.push({ target, ...a }) }) }

    Points.add(ROOM_ID, ALICE, 150, 'sing')
    Points.push(io, ROOM_ID)

    expect(emitted).toEqual([{ target: 'ROOM_ID_1', type: POINTS_PUSH, payload: Points.get(ROOM_ID) }])
  })
})
