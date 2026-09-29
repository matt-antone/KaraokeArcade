import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, open, close } from '../lib/Database.js'
import User from './User.js'
import Points from '../Points/Points.js'

/** The admin users list draws each account's portrait (09), so it has to
 *  carry the avatar like every other surface that names a person. */
describe('the admin users list', () => {
  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })
  })

  afterEach(close)

  it('carries each account\'s avatar, null for one that has not picked', () => {
    db.run(`INSERT INTO users (userId, username, password, name, roleId, avatarId)
      VALUES (1, 'alice', 'x', 'Alice', (SELECT roleId FROM roles WHERE name = 'standard'), 'halloween/hex')`)
    db.run(`INSERT INTO users (userId, username, password, name, roleId)
      VALUES (2, 'bob', 'x', 'Bob', (SELECT roleId FROM roles WHERE name = 'standard'))`)

    const { entities } = User.get()

    expect(entities[1].avatarId).toBe('halloween/hex')
    expect(entities[2].avatarId).toBeNull()
    // and still never a credential
    expect(entities[1]).not.toHaveProperty('password')
  })
})

/** Everyone who joins a room has a board row (023), so an admin deleting
 *  anyone who has been in a room tonight must not trip its foreign key. */
describe('removing a user', () => {
  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })
  })

  afterEach(close)

  it('takes their scores for tonight with them', () => {
    db.run('INSERT INTO rooms (roomId, name, status) VALUES (1, ?, ?)', ['Room', 'play'])
    db.run(`INSERT INTO users (userId, username, password, name, roleId)
      VALUES (5, 'carol', 'x', 'Carol', (SELECT roleId FROM roles WHERE name = 'standard'))`)
    Points.join(1, 5)
    db.run('INSERT INTO triviaScores (roomId, userId, score, numAnswered) VALUES (1, 5, 100, 1)')

    User.remove(5)

    expect(db.get('SELECT 1 FROM users WHERE userId = 5')).toBeUndefined()
    expect(Points.get(1)).toEqual([])
  })
})
