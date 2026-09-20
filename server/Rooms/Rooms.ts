import crypto from '../lib/crypto.js'
import sql from 'sqlate'
import { db } from '../lib/Database.js'
import { ValidationError } from '../lib/Errors.js'
import { ROOM_STATUSES } from '../../shared/types.js'

const NAME_MIN_LENGTH = 1
const NAME_MAX_LENGTH = 50
const PASSWORD_MIN_LENGTH = 5

export const STATUSES = ROOM_STATUSES as string[]

/**
 * Role prefs a room is created with: both guests and new standard accounts may
 * join. A singer arriving at the room for the first time has to be able to get
 * in without an admin editing settings first, whichever kind of account they
 * want; a host who wants it tighter turns either off in Settings > Rooms.
 */
function defaultRoles (): Record<number, { allowNew: boolean }> {
  const query = sql`SELECT roleId, name FROM roles WHERE name IN ('guest', 'standard')`
  const rows = db.all<{ roleId: number, name: string }>(String(query), query.parameters)

  // no rows means a schema older than these roles; a room with no role prefs
  // is the previous behaviour, so fall back to it rather than throwing
  return Object.fromEntries(rows.map(row => [row.roleId, { allowNew: true }]))
}

// Remember which users have been seen in each room
const roomUsers: Map<number, Set<number>> = new Map()

/**
 * The password half of validating a room. Its own function because it is the
 * only part that awaits anything, and because a legacy hash is rewritten as a
 * side effect of a successful check — three branches that have nothing to do
 * with whether the room exists or is open.
 */
async function checkPassword (roomId: number, stored: string, given: string | undefined): Promise<void> {
  if (!given) {
    throw new Error('Room password is required')
  }

  if (!(await crypto.compare(given, stored))) {
    throw new Error('Incorrect room password')
  }

  if (crypto.isLegacy(stored)) {
    const newHash = await crypto.hash(given)
    const query = sql`
      UPDATE rooms
      SET password = ${newHash}
      WHERE roomId = ${roomId}
    `
    db.run(String(query), query.parameters)
  }
}

/**
 * Whether a room admits new accounts of this role. Separate for the same
 * reason as the password: it is a lookup and a prefs read, and neither is
 * about the room's identity or its transport.
 */
function checkRoleAllowed (
  room: { prefs?: { roles?: Record<number, { allowNew?: boolean }> } },
  role: string,
): void {
  const query = sql`SELECT roleId FROM roles WHERE name = ${role}`
  const roleId = db.get<{ roleId: number }>(String(query), query.parameters)?.roleId

  if (!roleId) {
    throw new Error('Role not found')
  }

  if (!room.prefs?.roles?.[roleId]?.allowNew) {
    throw new Error(`New "${role}" accounts are not allowed in this room`)
  }
}

/** Why this room cannot be entered right now, or null. Reads as the list of
 *  refusals it is, and keeps the wording of all three in one place. */
function roomBlocker (room: { status: string } | undefined, isOpen: boolean): string | null {
  if (!room) return 'Room not found'
  if (!isOpen || room.status === 'play') return null

  return room.status === 'paused' ? 'Room is paused' : 'Room is no longer open'
}

class Rooms {
  /**
   * Get all rooms
   */
  static get (
    roomId: number | null | undefined = undefined,
    { status = ['play'], includePassword = false }: { status?: string[], includePassword?: boolean } = {},
  ): { result: number[], entities: Record<number, any> } {
    const result = []
    const entities = {}
    const whereConditions = []
    let whereClause = sql``

    if (typeof roomId === 'number') {
      whereConditions.push(sql`roomId = ${roomId}`)
    }

    if (status && status.length > 0) {
      whereConditions.push(sql`status IN ${sql.tuple(status)}`)
    }

    if (whereConditions.length > 0) {
      whereClause = sql`WHERE ${whereConditions.reduce((acc, curr, index) => {
        if (index > 0) return sql`${acc} AND ${curr}`
        return curr
      })}`
    }

    const query = sql`
      SELECT *
      FROM rooms
      ${whereClause}
      ORDER BY dateCreated DESC
    `
    const res = db.all<{
      roomId: number
      name: string // assuming name exists
      status: string // assuming status exists
      data: string
      password?: string | null
      dateCreated: string | number
      prefs?: any
      hasPassword?: boolean
    }>(String(query), query.parameters)

    res.forEach((row) => {
      const data = JSON.parse(row.data)
      row.prefs = data.prefs ?? {}
      delete row.data

      // Rooms created before role prefs existed carry no 'roles' key at all,
      // which reads as "no new accounts" and quietly stops a room accepting
      // singers after an upgrade. Default on read, not just on insert; a host
      // who actually turned guest signup off has a 'roles' key and is left be.
      if (!row.prefs.roles) row.prefs.roles = defaultRoles()

      row.hasPassword = !!row.password
      if (!includePassword) delete row.password

      row.dateCreated = parseInt(String(row.dateCreated), 10) // v1.0 schema used 'text' column

      result.push(row.roomId)
      entities[row.roomId] = row
    })

    return { result, entities }
  }

  static async set (roomId, room) {
    const { name, password, prefs } = room
    let query

    if (!name || !name.trim() || name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
      throw new ValidationError(`Room name must have ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters`)
    }

    if (password && password.length < PASSWORD_MIN_LENGTH) {
      throw new ValidationError(`Room password must have at least ${PASSWORD_MIN_LENGTH} characters`)
    }

    if (typeof roomId === 'number') {
      const passwordSql = typeof password === 'undefined'
        // leave unchanged
        ? sql``
        // empty string unsets password
        : sql`password = ${password === '' ? null : await crypto.hash(password)},`

      // status is deliberately absent: it is the room's transport now, and the
      // transport controls run side effects (stopping the player, clearing the
      // queue) that an edit-form save has no way to perform. Saving the form
      // must not silently move a room between states.
      query = sql`
        UPDATE rooms
        SET name = ${name},
            ${passwordSql}
            data = json_set(data, '$.prefs', json(${JSON.stringify(prefs)}))
        WHERE roomId = ${roomId}
      `
    } else {
      // A brand-new room lets guests in. The product is "scan the QR, type a
      // name, sing" — a room that denies self-registration until an admin
      // finds Settings > Rooms > Edit makes that impossible on a fresh
      // install, which is the first five minutes of every party. Only applied
      // on INSERT, so an admin who later turns guests off stays turned off.
      const newPrefs = prefs?.roles ? prefs : { ...prefs, roles: defaultRoles() }

      // a new room is playing. The host made it to start a night, and a room
      // that arrives paused is a room whose first singer cannot get in
      query = sql`
        INSERT INTO rooms (name, password, status, dateCreated, data)
        VALUES (
          ${name},
          ${typeof password === 'undefined' ? null : await crypto.hash(password)},
          'play',
          ${Math.floor(Date.now() / 1000)},
          json_set('{}', '$.prefs', json(${JSON.stringify(newPrefs)}))
        )
      `
    }

    return db.run(String(query), query.parameters)
  }

  /**
   * Validate a room against optional criteria
   */
  static async validate (
    roomId: number,
    password: string | undefined,
    {
      isOpen = true,
      validatePassword = true,
      role,
    }: {
      isOpen?: boolean
      validatePassword?: boolean
      role?: any
    } = {},
  ): Promise<boolean> {
    // Nobody's room is not a missing room. An admin may sign in without
    // choosing one — /login allows it deliberately, so they can reach Settings
    // — and their roomId is null from then on. Without this guard that null
    // falls through Rooms.get's `typeof roomId === 'number'` check, the query
    // runs with no room in it at all, and every playing room comes back; it
    // only fails because entities[null] happens to be undefined. Queueing a
    // song then told an admin "Room not found", which names the wrong thing
    // and sends them looking for a room that is sitting right there.
    if (typeof roomId !== 'number') {
      throw new Error('You\'re not in a room')
    }

    // Every status, not just the playing ones. Rooms.get defaults to
    // status: ['play'], so a paused or stopped room did not come back at all
    // and threw "Room not found" here — which made both branches below
    // unreachable, and made "admins can sign in to closed rooms" on the login
    // route a comment describing something that could not happen.
    const room = Rooms.get(roomId, { includePassword: true, status: STATUSES }).entities[roomId]
    const blocker = roomBlocker(room, isOpen)

    if (blocker) throw new Error(blocker)

    if (validatePassword && room.password) await checkPassword(roomId, room.password, password)
    if (role) checkRoleAllowed(room, role)

    return true
  }

  /**
   * Move a room's transport. The side effects of stopping — emptying the queue,
   * clearing the scoreboard, telling the player to stop — belong to the caller
   * that has the socket server; this only records where the room now is.
   */
  static setStatus (roomId: number, status: string): void {
    if (!STATUSES.includes(status)) {
      throw new ValidationError('Invalid room status')
    }

    const query = sql`
      UPDATE rooms
      SET status = ${status}
      WHERE roomId = ${roomId}
    `
    db.run(String(query), query.parameters)
  }

  static prefix (roomId: string | number = '') {
    return `ROOM_ID_${roomId}`
  }

  /**
   * Utility method to list active rooms on a socket.io instance
   */
  static getActive (io: any): { room: string, roomId: number }[] {
    const rooms = []

    for (const room of io.sockets.adapter.rooms.keys()) {
      // ignore auto-generated per-user rooms
      if (room.startsWith(Rooms.prefix())) {
        const roomId = parseInt(room.substring(Rooms.prefix().length), 10)
        rooms.push({ room, roomId })
      }
    }

    return rooms
  }

  /**
   * Utility method to determine if a player is in a room
   */
  static isPlayerPresent (io: any, roomId: number): boolean {
    for (const sock of io.of('/').sockets.values()) {
      if (sock.user && sock.user.roomId === roomId && sock._lastPlayerStatus) {
        return true
      }
    }

    return false
  }

  /**
   * Utility method to determine if a room's player is playing, as opposed to
   * merely being open somewhere with nothing on stage
   */
  static isPlayerPlaying (io, roomId: number): boolean {
    for (const sock of io.of('/').sockets.values()) {
      if (sock.user && sock.user.roomId === roomId && sock._lastPlayerStatus?.isPlaying) {
        return true
      }
    }

    return false
  }

  /** QueueIds the room's player has already left the stage on, per its own
   *  status — the only record of "sung" a queue row ever gets, since a song's
   *  row otherwise stays in the table forever (see Queue.remove: nothing
   *  calls it when a song merely finishes). */
  static getPlayerHistory (io, roomId: number): number[] {
    for (const sock of io.of('/').sockets.values()) {
      if (sock.user && sock.user.roomId === roomId && sock._lastPlayerStatus) {
        try {
          return JSON.parse(sock._lastPlayerStatus.historyJSON ?? '[]')
        } catch {
          return []
        }
      }
    }

    return []
  }

  /**
   * Remember that a user has been in a room
   */
  static trackUser (roomId: number, userId: number) {
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Set())
    }

    roomUsers.get(roomId)!.add(userId)
  }

  /**
   * Check if a user has been in a room (since server start)
   */
  static hasUserBeenInRoom (roomId: number, userId: number): boolean {
    return roomUsers.get(roomId)?.has(userId) ?? false
  }
}

export default Rooms
