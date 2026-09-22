import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, open, close } from '../lib/Database.js'
import User from './User.js'

/**
 * Every way User.create says no, and the two ways it says yes.
 *
 * Written before the function was split apart, and that is the point of it:
 * this is the account-creation gate, the wording of each refusal is what a
 * stranger sees on their first screen, and there was nothing at all standing
 * behind either. A rule quietly dropped in a refactor would not have shown up
 * until somebody got in who should not have.
 */

const ok = {
  username: 'newsinger',
  newPassword: 'sixteen chars ok',
  newPasswordConfirm: 'sixteen chars ok',
  name: 'New Singer',
}

describe('creating a user', () => {
  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })
  })

  afterEach(close)

  it('creates a standard account and hashes the password', async () => {
    const userId = await User.create({ ...ok })

    const row = db.get<{ username: string, name: string, password: string }>(
      'SELECT username, name, password FROM users WHERE userId = ?', [userId])!

    expect(row.username).toBe('newsinger')
    // one name per account: the username is also the name the room sees
    expect(row.name).toBe('newsinger')
    // never the plaintext
    expect(row.password).not.toBe(ok.newPassword)
    expect(row.password.length).toBeGreaterThan(20)
  })

  it('trims the username and ignores a separate display name', async () => {
    const userId = await User.create({ ...ok, username: '  spaced  ', name: '  Spaced Out  ' })

    const row = db.get<{ username: string, name: string }>(
      'SELECT username, name FROM users WHERE userId = ?', [userId])!

    expect(row.username).toBe('spaced')
    expect(row.name).toBe('spaced')
  })

  it.each([
    ['Name is required', { username: '' }],
    ['Name must have', { username: 'ab' }],
    ['Password is required', { newPassword: '', newPasswordConfirm: '' }],
    ['Password must have at least', { newPassword: 'abc', newPasswordConfirm: 'abc' }],
    ['Password confirmation is required', { newPasswordConfirm: '' }],
    ['New passwords do not match', { newPasswordConfirm: 'something else' }],
  ])('refuses with "%s"', async (message, override) => {
    await expect(User.create({ ...ok, ...override })).rejects.toThrow(message)
  })

  it('stores the security question and only a hash of the answer', async () => {
    const userId = await User.create({ ...ok, securityQuestion: 'What was the name of your first pet?', securityAnswer: 'Rex' })

    const row = db.get<{ securityQuestion: string, securityAnswer: string }>(
      'SELECT securityQuestion, securityAnswer FROM users WHERE userId = ?', [userId])!

    expect(row.securityQuestion).toBe('What was the name of your first pet?')
    expect(row.securityAnswer).not.toContain('rex')
    // and never handed out without asking for credentials
    expect((User.getById(userId) as { securityAnswer?: string }).securityAnswer).toBeUndefined()
  })

  it('refuses a username somebody already has', async () => {
    await User.create({ ...ok })

    await expect(User.create({ ...ok, name: 'Someone Else' }))
      .rejects.toThrow('That name is taken')
  })

  // A guest never types a username or a password, so none of the rules above
  // apply to one — but they still need a display name, and they still need a
  // username the database will accept as unique.
  it('gives a guest a generated username and asks them for nothing but a name', async () => {
    const userId = await User.create({ name: 'Just Passing' }, 'guest')

    const row = db.get<{ username: string, name: string, password: string }>(
      'SELECT username, name, password FROM users WHERE userId = ?', [userId])!

    expect(row.username).toMatch(/^guest-.{5}$/)
    expect(row.name).toBe('Just Passing')
    expect(row.password).toBe('guest')
  })

  it('still asks a guest for a name', async () => {
    await expect(User.create({}, 'guest')).rejects.toThrow('Name is required')
    await expect(User.create({ name: 'a' }, 'guest')).rejects.toThrow('Name must have')
  })

  it('gives two guests different usernames', async () => {
    const a = await User.create({ name: 'Guest One' }, 'guest')
    const b = await User.create({ name: 'Guest Two' }, 'guest')

    const names = db.all<{ username: string }>(
      'SELECT username FROM users WHERE userId IN (?, ?)', [a, b]).map(r => r.username)

    expect(new Set(names).size).toBe(2)
  })
})
