import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, open, close } from '../lib/Database.js'
import Rooms from './Rooms.js'

/**
 * A room decides who may join it. Before this default, a newly created room
 * had no role prefs at all, which meant nobody could self-register into it —
 * no guests, no new users — until an admin found Settings > Rooms > Edit and
 * turned it on. That makes the product's own premise ("scan the QR, type a
 * name, sing") unreachable on a fresh install. Both guest and standard signup
 * default on; a host who wants it tighter turns either off in that same screen.
 */

const roleId = (name: string) =>
  db.get<{ roleId: number }>('SELECT roleId FROM roles WHERE name = ?', [name])?.roleId

const prefsOf = (roomId: number) =>
  JSON.parse(db.get<{ data: string }>('SELECT data FROM rooms WHERE roomId = ?', [roomId])!.data).prefs

describe('room defaults', () => {
  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })
  })

  afterEach(close)

  it('lets guests into a newly created room', async () => {
    await Rooms.set(null, { name: 'Living Room' })

    const room = db.get<{ roomId: number }>('SELECT roomId FROM rooms WHERE name = ?', ['Living Room'])!
    expect(prefsOf(room.roomId).roles[roleId('guest')!].allowNew).toBe(true)
  })

  it('lets new standard accounts into a newly created room', async () => {
    // a singer who wants a real account must not need an admin to enable it first
    await Rooms.set(null, { name: 'Living Room' })

    const room = db.get<{ roomId: number }>('SELECT roomId FROM rooms WHERE name = ?', ['Living Room'])!
    expect(prefsOf(room.roomId).roles[roleId('standard')!].allowNew).toBe(true)
  })

  it('respects role prefs the caller supplied', async () => {
    // an admin explicitly turning guests off must not be overridden
    const guest = roleId('guest')!
    await Rooms.set(null, {
      name: 'Locked Room',
      prefs: { roles: { [guest]: { allowNew: false } } },
    })

    const room = db.get<{ roomId: number }>('SELECT roomId FROM rooms WHERE name = ?', ['Locked Room'])!
    expect(prefsOf(room.roomId).roles[guest].allowNew).toBe(false)
  })

  it('does not re-apply the default when an existing room is edited', async () => {
    const guest = roleId('guest')!
    await Rooms.set(null, { name: 'Room' })
    const roomId = db.get<{ roomId: number }>('SELECT roomId FROM rooms WHERE name = ?', ['Room'])!.roomId

    // the host turns guests off later; that must stick
    await Rooms.set(roomId, {
      name: 'Room',
      prefs: { roles: { [guest]: { allowNew: false } } },
    })

    expect(prefsOf(roomId).roles[guest].allowNew).toBe(false)
  })

  it('lets guests into a room that predates role prefs', () => {
    // rooms stored before this default carry no 'roles' key at all. Defaulting
    // only on insert left every upgraded install's existing room refusing new
    // singers, which is the same dead end the insert default was added to fix.
    db.run(
      'INSERT INTO rooms (name, status, dateCreated, data) VALUES (?, ?, 0, ?)',
      ['Old Room', 'play', JSON.stringify({ prefs: { qr: { isEnabled: true } } })],
    )

    const roomId = db.get<{ roomId: number }>('SELECT roomId FROM rooms WHERE name = ?', ['Old Room'])!.roomId
    const roles = Rooms.get(roomId).entities[roomId].prefs.roles
    expect(roles[roleId('guest')!].allowNew).toBe(true)
    expect(roles[roleId('standard')!].allowNew).toBe(true)
  })

  it('does not override a room that turned guests off', () => {
    // an explicit 'roles' key is the host's decision; reading must not undo it
    const guest = roleId('guest')!
    db.run(
      'INSERT INTO rooms (name, status, dateCreated, data) VALUES (?, ?, 0, ?)',
      ['Locked', 'play', JSON.stringify({ prefs: { roles: { [guest]: { allowNew: false } } } })],
    )

    const roomId = db.get<{ roomId: number }>('SELECT roomId FROM rooms WHERE name = ?', ['Locked'])!.roomId
    expect(Rooms.get(roomId).entities[roomId].prefs.roles[guest].allowNew).toBe(false)
  })
})

/**
 * What Rooms.validate is allowed to say no with.
 *
 * Every refusal here reaches a singer as a modal with one sentence in it, and
 * the sentence was wrong in two different ways: a room that was merely paused
 * came back as missing, and a user in no room at all came back as missing too.
 * Both told somebody to go looking for a room that was sitting right in front
 * of them.
 */
describe('validating a room', () => {
  const roomWith = (name: string, status: string) => {
    db.run('INSERT INTO rooms (name, status, dateCreated, data) VALUES (?, ?, 0, ?)', [name, status, '{}'])
    return db.get<{ roomId: number }>('SELECT roomId FROM rooms WHERE name = ?', [name])!.roomId
  }

  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })
  })

  afterEach(close)

  it('says so when the caller is in no room at all', async () => {
    // an admin may sign in without choosing one, so their roomId is null for
    // the rest of the session
    await expect(Rooms.validate(null as unknown as number, undefined, { validatePassword: false }))
      .rejects.toThrow('You\'re not in a room')
  })

  it('still says not found for a room that does not exist', async () => {
    await expect(Rooms.validate(9999, undefined, { validatePassword: false }))
      .rejects.toThrow('Room not found')
  })

  it('refuses a roomId that is still the string a form sent', async () => {
    const roomId = roomWith('Playing Room', 'play')

    // This is the contract every caller has to parse for, and the one that was
    // missed: the account form posts multipart, so its roomId arrives as "11",
    // and the guard above is a typeof check rather than a truthiness one on
    // purpose — a real null means an admin who chose no room. The cost of
    // getting it wrong is not a type error anywhere; it is every signup in the
    // product failing with "You're not in a room", which names the very thing
    // the person was choosing. Both callers (POST /user and POST /user/room)
    // parseInt before they get here.
    await expect(Rooms.validate(String(roomId) as unknown as number, undefined, { validatePassword: false }))
      .rejects.toThrow('You\'re not in a room')

    // and the same room, parsed, goes straight through
    await expect(Rooms.validate(roomId, undefined, { validatePassword: false }))
      .resolves.toBe(true)
  })

  it('names a paused room as paused rather than missing', async () => {
    const roomId = roomWith('Paused Room', 'paused')

    await expect(Rooms.validate(roomId, undefined, { validatePassword: false }))
      .rejects.toThrow('Room is paused')
  })

  it('names a stopped room as closed rather than missing', async () => {
    const roomId = roomWith('Stopped Room', 'stopped')

    await expect(Rooms.validate(roomId, undefined, { validatePassword: false }))
      .rejects.toThrow('Room is no longer open')
  })

  // the login route's "admins can sign in to closed rooms" was a comment
  // describing something that could not happen: the room was never fetched
  it('lets a caller past a closed room when isOpen is off', async () => {
    const roomId = roomWith('Closed Room', 'stopped')

    await expect(Rooms.validate(roomId, undefined, { isOpen: false, validatePassword: false }))
      .resolves.toBe(true)
  })

  it('passes a playing room', async () => {
    const roomId = roomWith('Open Room', 'play')

    await expect(Rooms.validate(roomId, undefined, { validatePassword: false }))
      .resolves.toBe(true)
  })
})

/**
 * The TV's crowd and the trivia lobby draw how many people are in the room.
 * The player display holds a socket like any phone, so it is left out, and one
 * person on two devices is one singer.
 */
describe('counting the room', () => {
  const sockets = [
    { id: 'a', user: { userId: 1, roomId: 1, avatarId: 'halloween/deb' } },
    { id: 'b', user: { userId: 2, roomId: 1 } },
    { id: 'b2', user: { userId: 2, roomId: 1 } },
    { id: 'tv', user: { userId: 1, roomId: 1 }, _lastPlayerStatus: { isPlaying: false } },
    { id: 'elsewhere', user: { userId: 3, roomId: 2 } },
    { id: 'signedOut', user: null },
  ]
  const fakeIo = () => {
    const emitted: { target: string, type: string, payload: unknown }[] = []

    return {
      emitted,
      of: () => ({ sockets: new Map(sockets.map(s => [s.id, s])) }),
      to: (target: string) => ({ emit: (_e: string, a: { type: string, payload: unknown }) => emitted.push({ target, ...a }) }),
    }
  }

  it('counts people, not sockets, and never the TV', () => {
    expect(Rooms.countSingers(fakeIo(), 1)).toBe(2)
    expect(Rooms.countSingers(fakeIo(), 2)).toBe(1)
    expect(Rooms.countSingers(fakeIo(), 3)).toBe(0)
  })

  it('tells the room its count', () => {
    const io = fakeIo()
    Rooms.pushSingers(io, 1)

    expect(io.emitted).toEqual([{
      target: 'ROOM_ID_1',
      type: 'rooms/ROOM_SINGERS_PUSH',
      payload: {
        roomId: 1,
        count: 2,
        // who, for the crowd: each person once, with their fighter or null
        singers: [{ userId: 1, avatarId: 'halloween/deb' }, { userId: 2, avatarId: null }],
      },
    }])
  })

  it('lists people in the order they first came in, not socket order', () => {
    // room 1 is shared with other tests' trackUser calls; this one is its own
    const io = { of: () => ({ sockets: new Map([
      ['x', { user: { userId: 7, roomId: 9 } }],
      ['y', { user: { userId: 8, roomId: 9 } }],
      ['z', { user: { userId: 6, roomId: 9 } }],
    ]) }) }

    Rooms.trackUser(9, 8)
    Rooms.trackUser(9, 6)

    // 7 was never tracked: after everyone who was
    expect(Rooms.getSingers(io, 9).map(s => s.userId)).toEqual([8, 6, 7])
  })
})
