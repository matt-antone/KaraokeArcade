import { db } from '../lib/Database.js'
import sql from 'sqlate'
import crypto from '../lib/crypto.js'
import Queue from '../Queue/Queue.js'
import { randomChars } from '../lib/util.js'
import { SongHistoryItem, User as UserType, isAvatarId } from '../../shared/types.js'
import { SECURITY_QUESTIONS } from '../../shared/securityQuestions.js'

type ServerUser = UserType & {
  role: string
  password?: string // only populated if requesting creds
  securityQuestion?: string | null
  securityAnswer?: string | null // hash; only populated if requesting creds
  image?: string
  rooms?: number[] // populated in router
}

export const IMG_MAX_LENGTH = 51200 // 50KB
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 50 // shown on the queue and player, so no longer than a name
export const PASSWORD_MIN_LENGTH = 6
export const NAME_MIN_LENGTH = 2
export const NAME_MAX_LENGTH = 50
const ANSWER_MIN_LENGTH = 2

/** Case, surrounding space and doubled spaces are not part of an answer. */
export const normalizeAnswer = (answer: string): string => answer.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * The two security columns, answer hashed, or undefined when neither was
 * given. Half a pair is refused: a question with no answer can never be
 * passed, and an answer with no question can never be asked.
 */
export async function securityFields (
  question?: string,
  answer?: string,
): Promise<{ securityQuestion: string, securityAnswer: string } | undefined> {
  const q = question?.trim() ?? ''
  const a = normalizeAnswer(answer ?? '')

  if (!q && !a) return undefined

  if (!(SECURITY_QUESTIONS as readonly string[]).includes(q)) {
    throw new Error('Please choose a security question')
  }

  if (a.length < ANSWER_MIN_LENGTH) {
    throw new Error(`Security answer must have at least ${ANSWER_MIN_LENGTH} characters`)
  }

  return { securityQuestion: q, securityAnswer: await crypto.hash(a) }
}

/**
 * Every rule a username and password have to pass before an account exists.
 *
 * Separate from create because it is the gate a stranger meets on their first
 * screen and the wording of each refusal is the whole of what they are told —
 * seven rules that deserve to be readable as a list rather than as the first
 * half of a long method.
 */
function assertCredentials (username: string, newPassword: string, newPasswordConfirm: string): void {
  if (!username) {
    throw new Error('Name is required')
  }

  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    throw new Error(`Name must have ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`)
  }

  if (!newPassword) {
    throw new Error('Password is required')
  }

  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must have at least ${PASSWORD_MIN_LENGTH} characters`)
  }

  if (!newPasswordConfirm) {
    throw new Error('Password confirmation is required')
  }

  if (newPassword !== newPasswordConfirm) {
    throw new Error('New passwords do not match')
  }

  if (User.getByUsername(username)) {
    throw new Error('That name is taken')
  }
}

/** A guest's name: they have no username, so this is what the room reads off
 *  the queue and the player. */
function assertDisplayName (name?: string): void {
  if (!name) {
    throw new Error('Name is required')
  }

  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    throw new Error(`Name must have ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters`)
  }
}

/** A guest-NNNNN nobody else has. Rolled rather than derived from anything, so
 *  it is asked of the database until one comes back free. */
function uniqueGuestUsername (): string {
  for (;;) {
    const username = `guest-${randomChars(5)}`
    const query = sql`
      SELECT COUNT(*) AS count
      FROM users
      WHERE username = ${username}
    `

    if ((db.get(String(query), query.parameters) as { count: number }).count === 0) {
      return username
    }
  }
}

class User {
  /**
   * Get user by userId
   *
   * @param creds Whether to include username and password in result
   */
  static getById (userId: number, creds: boolean = false): ServerUser | false {
    if (typeof userId !== 'number') {
      throw new Error('userId must be a number')
    }

    return User._get({ userId, username: undefined }, creds)
  }

  /**
   * Get user by username
   *
   * @param creds Whether to include username and password in result
   */
  static getByUsername (username: string, creds: boolean = false): ServerUser | false {
    if (typeof username !== 'string') {
      throw new Error('username must be a string')
    }

    return User._get({ userId: undefined, username }, creds)
  }

  /**
   * Gets all users
   *
   * @returns normalized list of users
   */
  static get (): { result: number[], entities: Record<number, ServerUser> } {
    const result = []
    const entities = {}

    const query = sql`
      SELECT users.userId, users.username, users.name, users.dateCreated, users.dateUpdated, roles.name AS role
      FROM users
        INNER JOIN roles USING (roleId)
      ORDER BY dateCreated DESC
    `
    const res = db.all<UserType & { role: string }>(String(query), query.parameters)

    res.forEach((row) => {
      result.push(row.userId)
      entities[row.userId] = row
    })

    return { result, entities }
  }

  static async create ({
    username,
    newPassword,
    newPasswordConfirm,
    name,
    image,
    avatarId,
    securityQuestion,
    securityAnswer,
  }: {
    username?: string
    newPassword?: string
    newPasswordConfirm?: string
    name?: string
    image?: Buffer
    avatarId?: string
    securityQuestion?: string
    securityAnswer?: string
  }, role = 'standard') {
    username = username?.trim()
    name = name?.trim()

    const fields = new Map()

    // A guest types neither a username nor a password, so none of the
    // credential rules apply to one — but the database still wants both
    // columns, and they still have to be unique.
    if (role === 'guest') {
      fields.set('username', uniqueGuestUsername())
      fields.set('password', 'guest')
    } else {
      assertCredentials(username, newPassword, newPasswordConfirm)
      fields.set('username', username)
      fields.set('password', await crypto.hash(newPassword))

      const security = await securityFields(securityQuestion, securityAnswer)
      if (security) {
        fields.set('securityQuestion', security.securityQuestion)
        fields.set('securityAnswer', security.securityAnswer)
      }
    }

    // One name per account: a username is also what the room reads. Only a
    // guest, who has no username, types a separate name.
    if (role === 'guest') {
      assertDisplayName(name)
      fields.set('name', name)
    } else {
      fields.set('name', username)
    }
    fields.set('dateCreated', Math.floor(Date.now() / 1000))
    fields.set('roleId', sql`(SELECT roleId FROM roles WHERE name = ${role})`)

    // Which fighter they are. Normally absent: a new account has not been
    // asked yet, and NULL is what makes the sign-in gate ask. Checked with the
    // same predicate the update path uses -- it reaches a CSS url() on every
    // other phone in the room either way it got here.
    if (avatarId) {
      if (!isAvatarId(avatarId)) {
        throw new Error('Invalid character')
      }

      fields.set('avatarId', avatarId)
    }

    // user image?
    if (image) {
      if (image.length > IMG_MAX_LENGTH) {
        throw new Error('Invalid image')
      }

      fields.set('image', image)
    }

    const query = sql`
    INSERT INTO users ${sql.tuple(Array.from(fields.keys()).map(sql.column))}
    VALUES ${sql.tuple(Array.from(fields.values()))}
  `
    const res = db.run(String(query), query.parameters)

    if (typeof res.lastID !== 'number') {
      throw new Error('Unable to create user')
    }

    return res.lastID
  }

  static async validate ({ username, password }) {
    if (!username || !password) {
      throw new Error('Name and password are required')
    }

    const user = User.getByUsername(username, true) as ServerUser

    if (!user || !(await crypto.compare(password, user.password))) {
      throw new Error('Incorrect name or password')
    }

    return user
  }

  /**
   * Record that a user sang a song all the way through. Keyed on the queue item so
   * the singer is whoever queued it, not whoever's signed in on the player.
   *
   * A battle row is two people singing two songs, and the second one is in the
   * opponent* columns rather than in a row of its own. Written here rather than
   * at the call site because this is the single path every song departs the
   * stage through, and an opponent who sang for two minutes and cannot find it
   * in Sung Tonight has no way to tell that from the song never counting.
   */
  static addPlay ({ queueId, roomId }: { queueId: number, roomId: number }): number {
    const dateSung = Math.floor(Date.now() / 1000)

    const query = sql`
      INSERT INTO songHistory (userId, artistNorm, titleNorm, dateSung)
      SELECT queue.userId, artists.nameNorm, songs.titleNorm, ${dateSung}
      FROM queue
      INNER JOIN songs USING(songId)
      INNER JOIN artists USING(artistId)
      WHERE queue.queueId = ${queueId} AND queue.roomId = ${roomId}
      ON CONFLICT (userId, artistNorm, titleNorm) DO UPDATE SET dateSung = excluded.dateSung
    `
    const changes = db.run(String(query), query.parameters).changes

    // Its own statement rather than a UNION with the one above: the two halves
    // join through different columns, and the INNER JOINs are what make this a
    // no-op on every row that is not a battle.
    const opponent = sql`
      INSERT INTO songHistory (userId, artistNorm, titleNorm, dateSung)
      SELECT queue.opponentUserId, artists.nameNorm, songs.titleNorm, ${dateSung}
      FROM queue
      INNER JOIN songs ON songs.songId = queue.opponentSongId
      INNER JOIN artists USING(artistId)
      WHERE queue.queueId = ${queueId} AND queue.roomId = ${roomId}
        AND queue.opponentUserId IS NOT NULL
      ON CONFLICT (userId, artistNorm, titleNorm) DO UPDATE SET dateSung = excluded.dateSung
    `

    return changes + db.run(String(opponent), opponent.parameters).changes
  }

  /**
   * Get a user's sung songs, most recent first. Like stars, rows whose song isn't
   * currently in the library just don't resolve.
   */
  static getHistory (userId: number): SongHistoryItem[] {
    const query = sql`
      SELECT songs.songId, songs.title, artists.name AS artist, songHistory.dateSung
      FROM songHistory
      INNER JOIN artists ON artists.nameNorm = songHistory.artistNorm
      INNER JOIN songs ON songs.artistId = artists.artistId AND songs.titleNorm = songHistory.titleNorm
      WHERE songHistory.userId = ${userId}
      ORDER BY songHistory.dateSung DESC
    `
    return db.all<SongHistoryItem>(String(query), query.parameters)
  }

  /**
   * Remove a user
   */
  static remove (userId: number): void {
    if (typeof userId !== 'number') {
      throw new Error('userId must be a number')
    }

    // Remove the user's queue items — including the battles where they are the
    // second fighter rather than the one who queued the row. opponentUserId
    // deliberately carries no foreign key (see 016-queue-battle.sql), so
    // nothing in the database would have stopped a battle surviving here with
    // a dangling opponent: a turn the room still shows as two people, one of
    // whom no longer exists, and which the player reaches and cannot run.
    const queueQuery = sql`
      SELECT queueId
      FROM queue
      WHERE userId = ${userId} OR opponentUserId = ${userId}
    `
    const queueRows = db.all<{ queueId: number }>(String(queueQuery), queueQuery.parameters)

    for (const row of queueRows) {
      Queue.remove(row.queueId)
    }

    // remove user's song history
    const historyQuery = sql`
      DELETE FROM songHistory
      WHERE userId = ${userId}
    `
    db.run(String(historyQuery), historyQuery.parameters)

    // remove user's song stars
    const songStarsQuery = sql`
      DELETE FROM songStars
      WHERE userId = ${userId}
    `
    db.run(String(songStarsQuery), songStarsQuery.parameters)

    // remove user's artist stars
    const artistStarsQuery = sql`
      DELETE FROM artistStars
      WHERE userId = ${userId}
    `
    db.run(String(artistStarsQuery), artistStarsQuery.parameters)

    // remove the user
    const usersQuery = sql`
      DELETE FROM users
      WHERE userId = ${userId}
    `
    const usersQueryRes = db.run(String(usersQuery), usersQuery.parameters)

    if (!usersQueryRes.changes) {
      throw new Error(`unable to remove userId: ${userId}`)
    }
  }

  /**
   * (private) runs the query
   * @param id with fields 'username' or 'userId'
   * @param creds whether to include username and password in result
   * @returns user object
   */
  static _get ({ userId, username }: { userId?: number, username?: string }, creds: boolean = false): ServerUser | false {
    const query = sql`
      SELECT users.*, roles.name AS role
      FROM users
        INNER JOIN roles USING (roleId)
      WHERE ${typeof userId === 'number' ? sql`userId = ${userId}` : sql`LOWER(username) = ${username.toLowerCase()}`}
    `

    const user = db.get<ServerUser>(String(query), query.parameters)
    if (!user) return false

    if (!creds) {
      delete user.username
      delete user.password
      delete user.securityAnswer
    }

    return user
  }
}

export default User
