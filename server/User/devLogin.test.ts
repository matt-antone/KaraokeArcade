import { describe, expect, it, vi } from 'vitest'
import mountDevLogin, { isDevLoginEnabled, isLoopback } from './devLogin.js'
import { db } from '../lib/Database.js'

vi.mock('../lib/Database.js', () => ({ db: { get: vi.fn() } }))

const fakeRouter = () => {
  const post = vi.fn()
  const get = vi.fn()
  return { router: { post, get }, post, get }
}

describe('isDevLoginEnabled', () => {
  it('needs both development and the opt-in flag', () => {
    expect(isDevLoginEnabled({ NODE_ENV: 'development', KES_DEV_LOGIN: '1' })).toBe(true)
  })

  // the door must not be open just because someone ran the dev server
  it('stays off in development without the flag', () => {
    expect(isDevLoginEnabled({ NODE_ENV: 'development' })).toBe(false)
  })

  // and setting the flag on a built server must not open it either
  it('stays off in production even with the flag', () => {
    expect(isDevLoginEnabled({ NODE_ENV: 'production', KES_DEV_LOGIN: '1' })).toBe(false)
  })

  it('stays off when NODE_ENV is unset', () => {
    expect(isDevLoginEnabled({ KES_DEV_LOGIN: '1' })).toBe(false)
  })
})

describe('isLoopback', () => {
  it('accepts loopback in the shapes it actually arrives in', () => {
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      expect(isLoopback(ip)).toBe(true)
    }
  })

  // a dev server binds the LAN, so every phone on the wifi reaches it
  it('refuses anything off-machine', () => {
    for (const ip of ['192.168.86.235', '10.0.0.4', '::ffff:192.168.86.235', undefined]) {
      expect(isLoopback(ip)).toBe(false)
    }
  })
})

describe('mountDevLogin', () => {
  it('does not register the route when the gates are shut', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('KES_DEV_LOGIN', '')
    const { router, post, get } = fakeRouter()

    expect(mountDevLogin(router, vi.fn(), vi.fn())).toBe(false)
    expect(post).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('registers the route when they are open', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('KES_DEV_LOGIN', '1')
    const { router, post, get } = fakeRouter()

    expect(mountDevLogin(router, vi.fn(), vi.fn())).toBe(true)
    expect(post).toHaveBeenCalledWith('/dev-login', expect.any(Function))
    expect(get).toHaveBeenCalledWith('/dev-login', expect.any(Function))
    vi.unstubAllEnvs()
  })

  /**
   * The dev admin is an ordinary account with an ordinary session, and the
   * field this would have dropped is the one that decides whether the app asks
   * you who you are. A hand-built second copy of the session payload would
   * have left the dev admin meeting the character picker on every sign-in
   * forever, which is why the payload is built in exactly one place now.
   */
  it('signs in through the shared session payload, so a new field cannot be dropped', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('KES_DEV_LOGIN', '1')
    const { router, post } = fakeRouter()

    vi.mocked(db.get).mockReturnValue({
      userId: 7,
      username: 'admin',
      name: 'Admin',
      dateCreated: 0,
      dateUpdated: 0,
      avatarId: 'halloween/hex',
      role: 'admin',
    })

    const createUserCtx = vi.fn((user, roomId) => ({ ...user, roomId }))
    mountDevLogin(router, vi.fn(), createUserCtx)

    const handler = post.mock.calls[0][1]
    const ctx = { request: { ip: '127.0.0.1', body: { roomId: '3' } }, query: {}, body: undefined as unknown }
    handler(ctx)

    expect(createUserCtx).toHaveBeenCalledWith(expect.objectContaining({ userId: 7 }), 3)
    expect(ctx.body).toMatchObject({ avatarId: 'halloween/hex', roomId: 3 })
    vi.unstubAllEnvs()
  })
})
