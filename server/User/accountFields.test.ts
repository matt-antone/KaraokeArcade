import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { open, close } from '../lib/Database.js'
import crypto from '../lib/crypto.js'
import User from './User.js'
import {
  assertCurrentPassword,
  assertImageSize,
  assertMayUpdate,
  assertSelfSignupRole,
  nextName,
  nextPassword,
  nextRole,
  nextUsername,
  type Fail,
} from './accountFields.js'

/**
 * The rules behind changing an account, which until now could only be reached
 * through a Koa handler and so were never tested at all.
 *
 * This is the path that changes passwords and grants admin. The two rules worth
 * staring at are that an admin cannot promote themselves and that changing your
 * own account makes you prove the current password — both are one condition
 * away from being a privilege escalation, and both are now pinned.
 */

/** Stands in for ctx.throw: records the refusal instead of raising it, so a
 *  single call can be asserted on without unwinding. */
const recorder = () => {
  const calls: Array<[number, string | undefined]> = []
  const fail: Fail = (status, message) => {
    calls.push([status, message])
  }

  return { calls, fail }
}

const ADMIN = { userId: 1, role: 'admin' }
const SINGER = { userId: 2, role: 'standard' }

describe('assertMayUpdate', () => {
  it('lets you change your own account', () => {
    const { calls, fail } = recorder()
    assertMayUpdate(fail, SINGER, SINGER.userId)

    expect(calls).toEqual([])
  })

  it('lets an admin change somebody else', () => {
    const { calls, fail } = recorder()
    assertMayUpdate(fail, ADMIN, SINGER.userId)

    expect(calls).toEqual([])
  })

  it('refuses a singer changing somebody else', () => {
    const { calls, fail } = recorder()
    assertMayUpdate(fail, SINGER, ADMIN.userId)

    expect(calls).toEqual([[401, undefined]])
  })

  it('refuses when there is no signed-in account behind the request', () => {
    const { calls, fail } = recorder()
    assertMayUpdate(fail, false, 1)

    expect(calls).toEqual([[401, undefined]])
  })
})

describe('assertCurrentPassword', () => {
  it('asks for it when changing your own account', async () => {
    const { calls, fail } = recorder()
    await assertCurrentPassword(fail, { actor: SINGER, targetId: SINGER.userId, isGuest: false })

    expect(calls).toEqual([[422, 'Current password is required']])
  })

  it('refuses a wrong one', async () => {
    const actor = { ...SINGER, password: await crypto.hash('the real one') }
    const { calls, fail } = recorder()

    await assertCurrentPassword(fail, { actor, targetId: SINGER.userId, isGuest: false, given: 'a guess' })

    expect(calls).toEqual([[401, 'Incorrect current password']])
  })

  it('accepts the right one', async () => {
    const actor = { ...SINGER, password: await crypto.hash('the real one') }
    const { calls, fail } = recorder()

    await assertCurrentPassword(fail, { actor, targetId: SINGER.userId, isGuest: false, given: 'the real one' })

    expect(calls).toEqual([])
  })

  // an admin editing somebody else is not claiming to be that person
  it('does not ask an admin editing another account', async () => {
    const { calls, fail } = recorder()
    await assertCurrentPassword(fail, { actor: ADMIN, targetId: SINGER.userId, isGuest: false })

    expect(calls).toEqual([])
  })

  it('does not ask a guest, who has no password', async () => {
    const { calls, fail } = recorder()
    await assertCurrentPassword(fail, { actor: SINGER, targetId: SINGER.userId, isGuest: true })

    expect(calls).toEqual([])
  })
})

describe('nextRole', () => {
  it('refuses an admin promoting themselves', () => {
    const { calls, fail } = recorder()
    nextRole(fail, 'admin', ADMIN, ADMIN.userId)

    expect(calls).toEqual([[403, undefined]])
  })

  it('refuses a singer handing out roles', () => {
    const { calls, fail } = recorder()
    nextRole(fail, 'admin', SINGER, ADMIN.userId)

    expect(calls).toEqual([[403, undefined]])
  })

  it('lets an admin set somebody else\'s role', () => {
    const { calls, fail } = recorder()
    const next = nextRole(fail, 'admin', ADMIN, SINGER.userId)

    expect(calls).toEqual([])
    expect(next).toBeDefined()
  })

  it('leaves the role alone when none was sent', () => {
    const { calls, fail } = recorder()

    expect(nextRole(fail, undefined, SINGER, SINGER.userId)).toBeUndefined()
    expect(calls).toEqual([])
  })
})

describe('the field rules', () => {
  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })
  })

  afterEach(close)

  it('trims a username and leaves an empty one alone', () => {
    const { calls, fail } = recorder()

    expect(nextUsername(fail, '  taken-later  ', false)).toBe('taken-later')
    expect(nextUsername(fail, '', false)).toBeUndefined()
    expect(calls).toEqual([])
  })

  it('refuses a username somebody already has', async () => {
    await User.create({
      username: 'already', newPassword: 'sixteen chars ok', newPasswordConfirm: 'sixteen chars ok', name: 'Already Here',
    })

    const { calls, fail } = recorder()
    nextUsername(fail, 'already', false)

    expect(calls).toEqual([[409, 'Username or email is not available']])
  })

  it('refuses a username that is too short', () => {
    const { calls, fail } = recorder()
    nextUsername(fail, 'ab', false)

    expect(calls[0][0]).toBe(400)
  })

  // a guest has no username to change, so the field is ignored rather than validated
  it('ignores a username sent by a guest', () => {
    const { calls, fail } = recorder()

    expect(nextUsername(fail, 'ab', true)).toBeUndefined()
    expect(calls).toEqual([])
  })

  it('trims a display name and refuses a too-short one', () => {
    const { calls, fail } = recorder()

    expect(nextName(fail, '  Roomy  ')).toBe('Roomy')
    expect(nextName(fail, undefined)).toBeUndefined()
    expect(calls).toEqual([])

    nextName(fail, 'a')
    expect(calls[0][0]).toBe(400)
  })

  it('hashes a new password rather than storing it', async () => {
    const { calls, fail } = recorder()
    const hashed = await nextPassword(fail, {
      newPassword: 'sixteen chars ok', newPasswordConfirm: 'sixteen chars ok', isGuest: false,
    })

    expect(calls).toEqual([])
    expect(hashed).not.toBe('sixteen chars ok')
    expect(await crypto.compare('sixteen chars ok', hashed as string)).toBe(true)
  })

  it('refuses a mismatched confirmation', async () => {
    const { calls, fail } = recorder()
    await nextPassword(fail, { newPassword: 'sixteen chars ok', newPasswordConfirm: 'something else', isGuest: false })

    expect(calls).toEqual([[422, 'New passwords do not match']])
  })

  it('refuses a too-short password', async () => {
    const { calls, fail } = recorder()
    await nextPassword(fail, { newPassword: 'abc', newPasswordConfirm: 'abc', isGuest: false })

    expect(calls[0][0]).toBe(400)
  })

  it('leaves the password alone for a guest', async () => {
    const { calls, fail } = recorder()

    expect(await nextPassword(fail, { newPassword: 'sixteen chars ok', isGuest: true })).toBeUndefined()
    expect(calls).toEqual([])
  })
})

describe('the upload and signup guards', () => {
  it('refuses an oversized avatar', () => {
    const { calls, fail } = recorder()
    assertImageSize(fail, 999_999_999)

    expect(calls[0][0]).toBe(413)
  })

  it('accepts a small one', () => {
    const { calls, fail } = recorder()
    assertImageSize(fail, 1024)

    expect(calls).toEqual([])
  })

  it.each(['guest', 'standard'])('lets somebody sign themselves up as %s', (role) => {
    const { calls, fail } = recorder()
    assertSelfSignupRole(fail, role)

    expect(calls).toEqual([])
  })

  // the whole point of the guard
  it.each(['admin', '', 'Admin'])('refuses signing up as "%s"', (role) => {
    const { calls, fail } = recorder()
    assertSelfSignupRole(fail, role)

    expect(calls).toEqual([[401, 'Invalid role']])
  })
})
