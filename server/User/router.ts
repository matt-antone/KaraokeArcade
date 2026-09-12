import fsPromises from 'node:fs/promises'
import { db } from '../lib/Database.js'
import sql from 'sqlate'
import jsonWebToken from 'jsonwebtoken'
import crypto from '../lib/crypto.js'
import KoaRouter from '@koa/router'
import { requireAdmin } from '../lib/util.js'
import Prefs from '../Prefs/Prefs.js'
import Queue from '../Queue/Queue.js'
import Rooms from '../Rooms/Rooms.js'
import User from '../User/User.js'
import mountDevLogin from './devLogin.js'
import {
  type Fail,
  assertCurrentPassword,
  assertImageSize,
  assertMayUpdate,
  assertSelfSignupRole,
  nextName,
  nextPassword,
  nextRole,
  nextUsername,
} from './accountFields.js'
import { QUEUE_PUSH } from '../../shared/actionTypes.js'
import { IMG_MAX_LENGTH } from './User.js'

interface File {
  filepath: string
  size: number
}

interface RequestWithBody {
  body: Record<string, any>
  files?: Record<string, File | File[]>
}

const router = new KoaRouter({ prefix: '/api' })
const { readFile, unlink: deleteFile } = fsPromises
const { sign: jwtSign } = jsonWebToken

// The JWT carries the room association (see createUserCtx), so a session-scoped
// cookie would drop the user's room whenever the browser/window is closed.
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 days

// Signs userCtx and sets it as the httpOnly session cookie
const setSessionCookie = (ctx, userCtx) => {
  const token = jwtSign(userCtx, ctx.jwtKey, { expiresIn: SESSION_MAX_AGE / 1000 })

  ctx.cookies.set('keToken', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
  })
}

// Development only, and off unless KES_DEV_LOGIN is set: sign in as an admin
// without a password, from loopback. See devLogin.ts for why it mints the
// ordinary session cookie rather than teaching any guard a new way to say yes.
mountDevLogin(router, setSessionCookie)

// Takes the "raw" object returned by the User class and massages it
// into the shape used by the client (state.user) and in server-side
// routers. Should be used to generate the JWT.
const createUserCtx = (user, roomId) => {
  return {
    dateCreated: user.dateCreated,
    dateUpdated: user.dateUpdated,
    isAdmin: user.role === 'admin',
    isGuest: user.role === 'guest',
    name: user.name,
    roomId: parseInt(roomId, 10) || null,
    userId: user.userId,
    username: user.username,
  }
}

// login
router.post('/login', async (ctx) => {
  const req = ctx.request as unknown as RequestWithBody
  const roomId = parseInt(req.body.roomId, 10) || null
  let user

  try {
    user = await User.validate(req.body as any)

    if (roomId) {
      await Rooms.validate(roomId, req.body.roomPassword, {
        isOpen: user.role !== 'admin', // admins can sign in to closed rooms
        validatePassword: true,
      })
    } else if (user.role !== 'admin') {
      ctx.throw(401, 'Please select a room')
    }
  } catch (err) {
    ctx.throw(401, err.message)
  }

  if (crypto.isLegacy(user.password)) {
    const newHash = await crypto.hash(req.body.password)
    const query = sql`
      UPDATE users
      SET password = ${newHash}, dateUpdated = ${Math.floor(Date.now() / 1000)}
      WHERE userId = ${user.userId}
    `
    db.run(String(query), query.parameters)
  }

  const userCtx = createUserCtx(user, roomId)

  setSessionCookie(ctx, userCtx)

  ctx.body = userCtx
})

// logout
router.get('/logout', (ctx) => {
  // @todo force socket room leave
  ctx.cookies.set('keToken', '')
  ctx.status = 200
  ctx.body = {}
})

/**
 * Change which room you are in, without signing out and back in.
 *
 * The room is carried in the JWT, so until this existed the only way to be in
 * a different one was to sign in again — and an admin, who /login deliberately
 * lets in with no room at all so they can reach Settings, had no way to get
 * into a room from inside the app. Their queue attempts refused with "you're
 * not in a room" and nothing on any screen offered them one.
 *
 * Same validation as /login and a re-issued cookie, so the two ways of ending
 * up in a room cannot drift apart: the password is checked, and an admin may
 * join a room that is paused or stopped where a singer may not.
 */
router.post('/user/room', async (ctx) => {
  const req = ctx.request as unknown as RequestWithBody

  if (typeof ctx.user.userId !== 'number') {
    ctx.throw(401)
  }

  const user = User.getById(ctx.user.userId, true)

  // returned, not just thrown: ctx.throw is not typed as never, so without the
  // return everything below still sees the `false` getById hands back for a
  // user that does not exist.
  if (!user) {
    return ctx.throw(404)
  }

  const roomId = parseInt(req.body.roomId, 10) || null

  if (!roomId) {
    ctx.throw(422, 'Please select a room')
  }

  try {
    await Rooms.validate(roomId, req.body.roomPassword, {
      isOpen: user.role !== 'admin',
      validatePassword: true,
    })
  } catch (err) {
    ctx.throw(401, err.message)
  }

  const userCtx = createUserCtx(user, roomId)

  // @todo: this should not extend the JWT expiry date, the same way the
  // account update above should not
  setSessionCookie(ctx, userCtx)

  ctx.body = userCtx
})

// get own account (helps sync account changes across devices)
router.get('/user', (ctx) => {
  if (typeof ctx.user.userId !== 'number') {
    ctx.throw(401)
  }

  // include credentials since their username may have changed
  const user = User.getById(ctx.user.userId, true)

  if (!user) {
    ctx.throw(404)
  }

  ctx.body = {
    ...createUserCtx(user, ctx.user.roomId),
    history: User.getHistory(ctx.user.userId),
  }
})

// list all users (admin only)
router.get('/users', requireAdmin, async (ctx) => {
  const userRooms = {} // { userId: [roomId, roomId, ...]}
  const sockets = await ctx.io.fetchSockets()

  for (const s of sockets) {
    if (s.user && typeof s.user.roomId === 'number') {
      if (userRooms[s.user.userId]) {
        userRooms[s.user.userId].push(s.user.roomId)
      } else {
        userRooms[s.user.userId] = [s.user.roomId]
      }
    }
  }

  // get all users
  const users = User.get()

  users.result.forEach((userId) => {
    users.entities[userId].rooms = userRooms[userId] || []
  })

  ctx.body = users
})

// delete a user (admin only)
router.delete('/user/:userId', async (ctx) => {
  const targetId = parseInt(ctx.params.userId, 10)

  if (!ctx.user.isAdmin || targetId === ctx.user.userId) {
    ctx.throw(403)
  }

  User.remove(targetId)

  // disconnect their socket session(s)
  const sockets = await ctx.io.fetchSockets()

  for (const s of sockets) {
    if (s?.user.userId === targetId) {
      s.disconnect()
    }
  }

  // emit (potentially) updated queues to each room
  for (const { room, roomId } of Rooms.getActive(ctx.io)) {
    ctx.io.to(room).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(roomId),
    })
  }

  // success
  ctx.status = 200
  ctx.body = {}
})

/**
 * Every column the UPDATE will set, and the two values the re-issued token
 * needs afterwards.
 *
 * Separate from the route because it is six independent field rules that each
 * decide whether they have anything to say at all — an empty field means
 * "leave it alone", never "clear it" — and because none of them are about the
 * request or the response around them. The order they run in is the order
 * their refusals reach the singer, so it is the order they were in before.
 */
async function buildUpdateFields (fail: Fail, ctx, req: RequestWithBody, user, targetId: number) {
  const isGuest = !!ctx.user.isGuest
  const fields = new Map()

  const username = nextUsername(fail, req.body.username, isGuest)
  const name = nextName(fail, req.body.name)
  const hashed = await nextPassword(fail, {
    newPassword: req.body.newPassword,
    newPasswordConfirm: req.body.newPasswordConfirm,
    isGuest,
  })

  if (username !== undefined) fields.set('username', username)
  if (name !== undefined) fields.set('name', name)
  if (hashed !== undefined) fields.set('password', hashed)

  // changing user image?
  if (req.files && req.files.image) {
    const imageFile = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image

    // the upload is removed either way: refused, it is not wanted; accepted, it
    // has been read into the row
    if (imageFile.size > IMG_MAX_LENGTH) await deleteFile(imageFile.filepath)
    assertImageSize(fail, imageFile.size)

    fields.set('image', await readFile(imageFile.filepath))
    await deleteFile(imageFile.filepath)
  } else if (req.body.image === 'null') {
    fields.set('image', null)
  }

  // changing role?
  const role = nextRole(fail, req.body.role, user, targetId)
  if (role !== undefined) fields.set('roleId', role)

  return { fields, username, name }
}

/** A changed display name shows on every queue row that singer owns, in every
 *  room. @todo: only update rooms the user is in */
function pushQueues (ctx): void {
  for (const { room, roomId } of Rooms.getActive(ctx.io)) {
    ctx.io.to(room).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(roomId),
    })
  }
}

/**
 * The account as it now stands, for the token that goes back.
 *
 * A guest has no credentials to re-validate, so their updated name is simply
 * taken; everybody else is looked up again by whatever username and password
 * they now have, which is also the check that the UPDATE above did what it
 * said it did.
 */
async function reissuedUser (
  fail: Fail,
  user: { role: string, name: string, username: string },
  { username, name, password, newPassword }: {
    username?: string
    name?: string
    password?: string
    newPassword?: string
  },
) {
  if (user.role === 'guest') return { ...user, name: name || user.name }

  try {
    return await User.validate({
      username: username || user.username,
      password: newPassword || password,
    })
  } catch (err) {
    return fail(401, err.message)
  }
}

// update a user account
router.put('/user/:userId', async (ctx) => {
  const targetId = parseInt(ctx.params.userId, 10)
  const user = User.getById(ctx.user.userId, true)
  const fail = (status: number, message?: string) => ctx.throw(status, message)

  // must be admin if updating another user
  assertMayUpdate(fail, user, targetId)
  if (!user) return

  const req = ctx.request as unknown as RequestWithBody
  const { password, newPassword } = req.body

  await assertCurrentPassword(fail, { actor: user, targetId, isGuest: !!ctx.user.isGuest, given: password })

  // validated
  const { fields, username, name } = await buildUpdateFields(fail, ctx, req, user, targetId)

  fields.set('dateUpdated', Math.floor(Date.now() / 1000))

  const query = sql`
    UPDATE users
    SET ${sql.tuple(Array.from(fields.keys()).map(sql.column))} = ${sql.tuple(Array.from(fields.values()))}
    WHERE userId = ${targetId}
  `
  const res = db.run(String(query), query.parameters)

  if (!res.changes) {
    ctx.throw(404, `userId ${targetId} not found`)
  }

  pushQueues(ctx)

  // updating another account? we're done
  if (targetId !== user.userId) {
    ctx.status = 200
    ctx.body = {}
    return
  }

  const userCtx = createUserCtx(
    await reissuedUser(fail, user, { username, name, password, newPassword }),
    ctx.user.roomId || null,
  )

  // @todo: this should not extend the JWT expiry date
  setSessionCookie(ctx, userCtx)

  ctx.body = userCtx
})

/**
 * Whether a stranger may create the account they are asking for.
 *
 * Only reached when the requester is not an admin — an admin creating accounts
 * for other people is doing something else and skips all three. A new account
 * has to be nobody yet, has to be a role somebody is allowed to give
 * themselves, and has to name the room it is joining, since a room decides
 * which kinds of new account it admits.
 */
async function assertMaySignUp (
  fail: Fail,
  actor: { userId: number | null },
  body: { role?: string, roomId?: number, roomPassword?: string },
) {
  // already signed in?
  if (actor.userId !== null) fail(401, 'You are already signed in')

  // only possible roles; further validated per-room below
  assertSelfSignupRole(fail, body.role)

  // new users must choose a room at the same time
  try {
    await Rooms.validate(body.roomId, body.roomPassword, { role: body.role })
  } catch (err) {
    fail(401, err.message)
  }
}

// create account
router.post('/user', async (ctx) => {
  const req = ctx.request as unknown as RequestWithBody
  let image

  const fail = (status: number, message?: string) => ctx.throw(status, message)

  if (!ctx.user.isAdmin) await assertMaySignUp(fail, ctx.user, req.body)

  if (req.files && req.files.image) {
    const imageFile = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image

    // the upload is removed either way: refused, it is not wanted; accepted, it
    // has been read into the row
    if (imageFile.size > IMG_MAX_LENGTH) await deleteFile(imageFile.filepath)
    assertImageSize(fail, imageFile.size)

    image = await readFile(imageFile.filepath)
    await deleteFile(imageFile.filepath)
  }

  // create user
  try {
    const userId = await User.create({ ...req.body, image } as any, req.body.role)

    // if admin creating another user, we're done
    if (ctx.user.isAdmin) {
      ctx.status = 200
      ctx.body = {}
      return
    }

    const user = User.getById(userId, true)

    if (!user) {
      throw new Error('User not found')
    }

    const userCtx = createUserCtx(user, req.body.roomId || null)

    setSessionCookie(ctx, userCtx)

    ctx.body = userCtx
  } catch (err) {
    ctx.throw(403, err.message)
  }
})

// first-time setup
router.post('/setup', async (ctx) => {
  const prefs: any = Prefs.get()
  let image

  // must be first run
  if (prefs.isFirstRun !== true) {
    ctx.throw(403)
  }

  try {
    // create admin user
    const req = ctx.request as unknown as RequestWithBody
    const userId = await User.create({ ...req.body, image } as any, 'admin')
    const user = User.getById(userId, true)

    if (!user) {
      throw new Error('User not found')
    }

    // create default room
    const fields = new Map()
    fields.set('name', 'Room 1')
    fields.set('status', 'open')
    fields.set('dateCreated', Math.floor(Date.now() / 1000))

    const roomQuery = sql`
      INSERT INTO rooms ${sql.tuple(Array.from(fields.keys()).map(sql.column))}
      VALUES ${sql.tuple(Array.from(fields.values()))}
    `
    const roomRes = db.run(String(roomQuery), roomQuery.parameters)

    if (typeof roomRes.lastID !== 'number') {
      ctx.throw(500, 'Invalid default room lastID')
    }

    const userCtx = createUserCtx(user, roomRes.lastID)

    setSessionCookie(ctx, userCtx)

    // unset isFirstRun
    const query = sql`
      UPDATE prefs
      SET data = 'false'
      WHERE key = 'isFirstRun'
    `
    db.run(String(query))

    // success
    ctx.body = userCtx
  } catch (err) {
    ctx.throw(403, err.message)
  }
})

// get a user's image
router.get('/user/:userId/image', (ctx) => {
  const targetId = parseInt(ctx.params.userId, 10)

  if (ctx.user.userId !== targetId && !ctx.user.isAdmin) {
    // ensure target user has been in the same room
    if (!Rooms.hasUserBeenInRoom(ctx.user.roomId, targetId)) {
      ctx.throw(403)
    }
  }

  const user = User.getById(targetId)

  if (!user || !user.image) {
    ctx.throw(404)
    return
  }

  if (typeof ctx.query.v !== 'undefined') {
    // client can cache a versioned image forever
    ctx.set('Cache-Control', 'max-age=31536000') // 1 year
  }

  ctx.type = 'image/jpeg'
  ctx.body = Buffer.from(user.image)
})

export default router
