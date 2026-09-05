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
