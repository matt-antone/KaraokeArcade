import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { open, close } from '../lib/Database.js'
import crypto from '../lib/crypto.js'
import User from './User.js'
import {
  assertImageSize,
  assertMayUpdate,
  assertSecurityAnswer,
  assertSelfSignupRole,
  nextAvatarId,
  nextName,
  nextPassword,
  nextRole,
  nextSecurity,
  nextUsername,
  RESET_LOCKOUT_MS,
  RESET_MAX_ATTEMPTS,
  type Fail,
} from './accountFields.js'

/**
 * The rules behind changing an account, which until now could only be reached
 * through a Koa handler and so were never tested at all.
 *
 * This is the path that changes passwords and grants admin. The rule worth
 * staring at is that an admin cannot promote themselves — one condition away
 * from being a privilege escalation, and now pinned.
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

    expect(calls).toEqual([[409, 'That name is taken']])
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

describe('assertSecurityAnswer', () => {
  const account = async (username: string) => ({
    username,
    role: 'standard',
    securityAnswer: await crypto.hash('paris'),
  })

  it('accepts the answer regardless of case and spacing', async () => {
    const { calls, fail } = recorder()
    await assertSecurityAnswer(fail, await account('answerer'), '  PARIS ')

    expect(calls).toEqual([])
  })

  it('refuses a wrong answer', async () => {
    const { calls, fail } = recorder()
    await assertSecurityAnswer(fail, await account('wrong'), 'london')

    expect(calls).toEqual([[401, 'Incorrect answer']])
  })

  it('refuses an account with no question, and a guest', async () => {
    const { calls, fail } = recorder()
    await assertSecurityAnswer(fail, { username: 'none', role: 'standard', securityAnswer: null }, 'paris')
    await assertSecurityAnswer(fail, { username: 'guest-x', role: 'guest', securityAnswer: 'x' }, 'x')
    await assertSecurityAnswer(fail, false, 'paris')

    expect(calls.map(c => c[0])).toEqual([404, 404, 404])
  })

  it('locks the account after too many wrong answers, even to the right one, until it runs out', async () => {
    const user = await account('guesser')
    const now = 1_000_000

    for (let i = 0; i < RESET_MAX_ATTEMPTS; i++) {
      await assertSecurityAnswer(recorder().fail, user, 'nope', now)
    }

    const locked = recorder()
    await assertSecurityAnswer(locked.fail, user, 'paris', now + 1)
    expect(locked.calls).toEqual([[429, expect.any(String)]])

    const later = recorder()
    await assertSecurityAnswer(later.fail, user, 'paris', now + RESET_LOCKOUT_MS + 1)
    expect(later.calls).toEqual([])
  })
})

describe('nextSecurity', () => {
  it('hashes the normalized answer and keeps the question', async () => {
    const { calls, fail } = recorder()
    const res = await nextSecurity(fail, { securityQuestion: ' What was the name of your first pet? ', securityAnswer: ' Rex ', isGuest: false })

    expect(calls).toEqual([])
    expect(res?.securityQuestion).toBe('What was the name of your first pet?')
    expect(await crypto.compare('rex', res!.securityAnswer)).toBe(true)
  })

  it('leaves both alone when neither is given, and for a guest', async () => {
    const { calls, fail } = recorder()

    expect(await nextSecurity(fail, { isGuest: false })).toBeUndefined()
    expect(await nextSecurity(fail, { securityQuestion: 'What was the name of your first pet?', securityAnswer: 'rex', isGuest: true })).toBeUndefined()
    expect(calls).toEqual([])
  })

  it('refuses a question that is not one of the presets', async () => {
    const { calls, fail } = recorder()
    await nextSecurity(fail, { securityQuestion: 'What is my password?', securityAnswer: 'hunter2', isGuest: false })

    expect(calls).toEqual([[400, 'Please choose a security question']])
  })

  it('refuses half a pair', async () => {
    const { calls, fail } = recorder()
    await nextSecurity(fail, { securityQuestion: 'What was the name of your first pet?', isGuest: false })
    await nextSecurity(fail, { securityAnswer: 'rex', isGuest: false })

    expect(calls.map(c => c[0])).toEqual([400, 400])
  })
})

describe('nextAvatarId', () => {
  it('leaves the column alone when the form says nothing about it', () => {
    const { calls, fail } = recorder()

    // three ways a form can say "not this field": every other rule in here
    // reads an absent value the same way, and none of them mean "clear it"
    expect(nextAvatarId(fail, undefined)).toBeUndefined()
    expect(nextAvatarId(fail, null)).toBeUndefined()
    expect(nextAvatarId(fail, '')).toBeUndefined()
    expect(calls).toEqual([])
  })

  it('accepts both id shapes the grid can offer, including a capitalised group', () => {
    const { calls, fail } = recorder()

    // A group folder called `Halloween` passes the client's own filter and is
    // drawn on the grid, so a case-sensitive check here would 422 a fighter
    // the singer just tapped. Both ends share one regex precisely so they
    // cannot disagree about this.
    expect(nextAvatarId(fail, 'Halloween/Hex')).toBe('Halloween/Hex')
    expect(nextAvatarId(fail, 'halloween/hex')).toBe('halloween/hex')
    expect(nextAvatarId(fail, 'p1')).toBe('p1')
    expect(calls).toEqual([])
  })

  it('refuses anything that would not survive being put in a url()', () => {
    // This value reaches every other phone in the room and is interpolated
    // into CSS there. Nothing downstream re-checks it, so this is the check.
    for (const hostile of [
      '../../etc/passwd',
      'default/belter/../../..',
      'p1\') url(\'http://evil',
      'group/slug/extra',
      '-leading-dash',
      'a'.repeat(65),
      42,
      {},
    ]) {
      const { calls, fail } = recorder()

      expect(nextAvatarId(fail, hostile)).toBeUndefined()
      expect(calls).toEqual([[422, 'Invalid character']])
    }
  })
})
