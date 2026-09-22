import sql from 'sqlate'
import crypto from '../lib/crypto.js'
import { isAvatarId } from '../../shared/types.js'
import User, {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  normalizeAnswer,
  securityFields,
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
}

/** Only yourself, unless you are an admin. */
export function assertMayUpdate (fail: Fail, actor: Actor | false, targetId: number): void {
  if (!actor) return fail(401)
  if (targetId !== actor.userId && actor.role !== 'admin') fail(401)
}

/** The trimmed username, once it is known to be free and the right length.
 *  Undefined when there is nothing to change — a guest has no username, and an
 *  empty field means "leave it alone" rather than "clear it". */
export function nextUsername (fail: Fail, username: string | undefined, isGuest: boolean): string | undefined {
  if (!username || isGuest) return undefined

  const next = username.trim()

  if (next.length < USERNAME_MIN_LENGTH || next.length > USERNAME_MAX_LENGTH) {
    fail(400, `Name must have ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`)
  }

  if (User.getByUsername(next)) fail(409, 'That name is taken')

  return next
}

/** A guest's trimmed name, or undefined to leave it alone. */
export function nextName (fail: Fail, name: string | undefined): string | undefined {
  if (!name) return undefined

  const next = name.trim()

  if (next.length < NAME_MIN_LENGTH || next.length > NAME_MAX_LENGTH) {
    fail(400, `Name must have ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters`)
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

/** Which fighter this account is, or undefined to leave it alone.
 *
 *  Refuses rather than coerces, unlike Battle's toSingerId. The two are the
 *  same shape check on two different paths, and the difference is who is
 *  asking: this one is somebody tapping a tile they can see, so a value that
 *  is not a roster id is a broken client or an attack, and answering it with
 *  the default fighter would write a lie into the users table and hide the
 *  bug. toSingerId is handed whatever an unrefreshed session still believes,
 *  mid-battle, where a refusal costs the room a fight.
 *
 *  The id is interpolated into a CSS url() on every other phone in the room,
 *  which is why the check is here at all and why it is the same regex the
 *  client filters the fighter listing with. */
export function nextAvatarId (fail: Fail, avatarId: unknown): string | undefined {
  if (avatarId === undefined || avatarId === null || avatarId === '') return undefined

  if (!isAvatarId(avatarId)) {
    fail(422, 'Invalid character')

    return undefined
  }

  return avatarId
}

/** The two roles somebody may sign themselves up as. Anything else is either a
 *  typo or an attempt to make themselves an admin. */
export function assertSelfSignupRole (fail: Fail, role: string): void {
  if (!['guest', 'standard'].includes(role)) fail(401, 'Invalid role')
}

/** A new security question and hashed answer, or undefined to leave them
 *  alone. A guest has no password to reset. */
export async function nextSecurity (
  fail: Fail,
  { securityQuestion, securityAnswer, isGuest }: { securityQuestion?: string, securityAnswer?: string, isGuest: boolean },
): Promise<{ securityQuestion: string, securityAnswer: string } | undefined> {
  if (isGuest) return undefined

  try {
    return await securityFields(securityQuestion, securityAnswer)
  } catch (err) {
    fail(400, err.message)
  }
}

export const RESET_MAX_ATTEMPTS = 5
export const RESET_LOCKOUT_MS = 15 * 60 * 1000

// ponytail: in-memory and per-username, so a restart forgets it; move to a
// table if restarts become a way around it
const resetFailures = new Map<string, { count: number, lockedUntil: number }>()

/**
 * Whether the answer given is the one on the account, for a password reset.
 *
 * Wrong answers count against the username, and after RESET_MAX_ATTEMPTS the
 * account refuses every answer (right ones too) for RESET_LOCKOUT_MS. Without
 * that, a short answer is a few thousand guesses from anyone on the wifi.
 */
export async function assertSecurityAnswer (
  fail: Fail,
  user: { username: string, role: string, securityAnswer?: string | null } | false,
  given: string | undefined,
  now = Date.now(),
): Promise<void> {
  if (!user || user.role === 'guest' || !user.securityAnswer) {
    return fail(404, 'That account has no security question. Ask the host to reset your password.')
  }

  const key = user.username.toLowerCase()
  const entry = resetFailures.get(key)

  if (entry && entry.lockedUntil > now) {
    return fail(429, 'Too many wrong answers. Try again later or ask the host.')
  }

  if (given && await crypto.compare(normalizeAnswer(given), user.securityAnswer)) {
    resetFailures.delete(key)
    return
  }

  // a lockout that has run out starts the count again
  const count = (!entry || entry.lockedUntil ? 0 : entry.count) + 1
  resetFailures.set(key, { count, lockedUntil: count >= RESET_MAX_ATTEMPTS ? now + RESET_LOCKOUT_MS : 0 })

  fail(401, 'Incorrect answer')
}
