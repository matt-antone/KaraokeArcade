import sql from 'sqlate'
import { db } from '../lib/Database.js'
import getLogger from '../lib/Log.js'

const log = getLogger('devLogin')

/**
 * Sign in as an existing admin without a password, for local development.
 *
 * Deliberately a *login shortcut* rather than an authorization bypass: it mints
 * the ordinary session cookie for a real admin row and then gets out of the
 * way. Nothing downstream — no route guard, no socket handler, no Rooms.validate
 * — learns a new way to be satisfied, so there is no weakened path left behind
 * if the gates below ever come loose.
 *
 * Three locks, all of which must be open:
 *   - NODE_ENV is development. The route is not even mounted in a built server.
 *   - KES_DEV_LOGIN is set. Off by default, so an ordinary `npm run dev` on a
 *     laptop at a party is not sitting there with an open door.
 *   - the request came from loopback. A dev server binds the LAN by design;
 *     without this, "development" would mean every phone on the wifi is an
 *     admin.
 *
 * It cannot create an admin, only borrow one: a database with no admin gets a
 * 404, the same as a database with no such route.
 */
export const isDevLoginEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.NODE_ENV === 'development' && !!env.KES_DEV_LOGIN

// ::1 and ::ffff:127.0.0.1 are the shapes loopback arrives in over IPv6
export const isLoopback = (ip: string | undefined): boolean =>
  ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'

const getAdmin = () => {
  const query = sql`
    SELECT users.userId, users.username, users.name, users.dateCreated, users.dateUpdated,
      users.avatarId, roles.name AS role
    FROM users
      INNER JOIN roles USING (roleId)
    WHERE roles.name = 'admin'
    ORDER BY users.userId
    LIMIT 1
  `

  return db.get<{
    userId: number
    username: string
    name: string
    dateCreated: number
    dateUpdated: number
    avatarId: string | null
    role: string
  }>(String(query), query.parameters)
}

/**
 * Registers the route on the given router when every lock is open. Returns
 * whether it did, so startup can say so out loud — a door you cannot see is
 * worse than one you can.
 */
export default function mountDevLogin (router, setSessionCookie, createUserCtx): boolean {
  if (!isDevLoginEnabled()) return false

  const signIn = (ctx) => {
    if (!isLoopback(ctx.request.ip)) ctx.throw(403, 'Loopback only')

    const admin = getAdmin()
    if (!admin) ctx.throw(404, 'No admin account exists')

    const roomId = parseInt(ctx.request.body?.roomId ?? ctx.query.roomId, 10) || null

    // Through createUserCtx rather than hand-built. A second literal of the
    // same payload is a second place to forget a field, and the field it
    // forgot last time was avatarId -- which would have left the dev admin
    // being asked to pick a character on every single sign-in.
    const userCtx = createUserCtx(admin, roomId)

    setSessionCookie(ctx, userCtx)
    log.warn('dev-login: signed in as %s (userId: %s)', admin.username, admin.userId)

    return userCtx
  }

  router.post('/dev-login', (ctx) => {
    ctx.body = signIn(ctx)
  })

  // The cookie alone does not get you into the app: the client keeps its own
  // copy of the session under redux-persist's 'persist:user' key and boots from
  // that, so a cookie with no persisted state still lands on the sign-in
  // screen. Navigating here does both halves and drops you in the app, which is
  // the only reason this exists — a shortcut you have to finish by hand is not
  // one. Same locks as the POST; it shares the handler.
  router.get('/dev-login', (ctx) => {
    const userCtx = signIn(ctx)
    const to = typeof ctx.query.to === 'string' && ctx.query.to.startsWith('/') ? ctx.query.to : '/'

    ctx.type = 'text/html'
    ctx.body = `<!doctype html><meta charset="utf-8"><title>dev-login</title><script>
      localStorage.setItem('persist:user', ${JSON.stringify(JSON.stringify(
        Object.fromEntries(Object.entries(userCtx).map(([k, v]) => [k, JSON.stringify(v)])),
      ))});
      location.replace(${JSON.stringify(to)});
    </script>Signing in…`
  })

  log.warn('KES_DEV_LOGIN is set: /api/dev-login signs in as an admin without a password')
  return true
}
