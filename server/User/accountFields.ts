import sql from 'sqlate'
import crypto from '../lib/crypto.js'
import User, {
  IMG_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from './User.js'

/**
 * The rules behind updating an account, apart from the route that applies them.
 *
 * Every one of these was a block inside a single 150-line Koa handler that
 * validated permissions, four fields, an upload and a role change while
 * building the UPDATE as it went. None of it could be tested without standing
 * up a Koa context, so none of it was — which for the path that changes
 * passwords and grants admin is the wrong thing to have no tests for.
 *
 * They take a `fail` rather than the ctx so they can be exercised directly;
 * the route passes ctx.throw and nothing about its behaviour changes.
 */

/** Refuse with an HTTP status, the way ctx.throw does. */
export type Fail = (status: number, message?: string) => void

interface Actor {
  userId: number
  role: string
  password?: string
}

/** Only yourself, unless you are an admin. */
export function assertMayUpdate (fail: Fail, actor: Actor | false, targetId: number): void {
  if (!actor) return fail(401)
  if (targetId !== actor.userId && actor.role !== 'admin') fail(401)
}

/**
 * Changing your own account means proving you still know the password for it.
 * An admin editing somebody else does not — they are not claiming to be that
 * person — and a guest has no password to prove.
 */
export async function assertCurrentPassword (
  fail: Fail,
  { actor, targetId, isGuest, given }: { actor: Actor, targetId: number, isGuest: boolean, given?: string },
): Promise<void> {
  if (targetId !== actor.userId || isGuest) return

  if (!given) return fail(422, 'Current password is required')
  if (!(await crypto.compare(given, actor.password as string))) fail(401, 'Incorrect current password')
}

/** The trimmed username, once it is known to be free and the right length.
 *  Undefined when there is nothing to change — a guest has no username, and an
 *  empty field means "leave it alone" rather than "clear it". */
export function nextUsername (fail: Fail, username: string | undefined, isGuest: boolean): string | undefined {
  if (!username || isGuest) return undefined

  const next = username.trim()

  if (next.length < USERNAME_MIN_LENGTH || next.length > USERNAME_MAX_LENGTH) {
    fail(400, `Username or email must have ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`)
  }

  if (User.getByUsername(next)) fail(409, 'Username or email is not available')

  return next
}

/** The trimmed display name, or undefined to leave it alone. */
export function nextName (fail: Fail, name: string | undefined): string | undefined {
  if (!name) return undefined

  const next = name.trim()

  if (next.length < NAME_MIN_LENGTH || next.length > NAME_MAX_LENGTH) {
    fail(400, `Display name must have ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters`)
  }

  return next
}

/** A new password, hashed, or undefined to leave it alone. A guest has none to
 *  change. */
export async function nextPassword (
  fail: Fail,
  { newPassword, newPasswordConfirm, isGuest }: { newPassword?: string, newPasswordConfirm?: string, isGuest: boolean },
): Promise<string | undefined> {
  if (!newPassword || isGuest) return undefined

  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    fail(400, `Password must have at least ${PASSWORD_MIN_LENGTH} characters`)
  }

  if (newPassword !== newPasswordConfirm) fail(422, 'New passwords do not match')

  return await crypto.hash(newPassword)
}

/**
 * A role change, as the subselect the UPDATE wants.
 *
 * @todo since we're not ensuring there'd be at least one admin remaining,
 * changing one's own role is currently disallowed
 */
export function nextRole (fail: Fail, role: string | undefined, actor: Actor, targetId: number) {
  if (!role) return undefined

  if (actor.role !== 'admin' || targetId === actor.userId) fail(403)

  return sql`(SELECT roleId FROM roles WHERE name = ${role})`
}

/** An uploaded avatar, refused if it is too big to sit in the users table. */
export function assertImageSize (fail: Fail, size: number): void {
  if (size > IMG_MAX_LENGTH) {
    fail(413, `Image must not exceed ${Math.floor(IMG_MAX_LENGTH / 1024)}KB`)
  }
}

/** The two roles somebody may sign themselves up as. Anything else is either a
 *  typo or an attempt to make themselves an admin. */
export function assertSelfSignupRole (fail: Fail, role: string): void {
  if (!['guest', 'standard'].includes(role)) fail(401, 'Invalid role')
}
