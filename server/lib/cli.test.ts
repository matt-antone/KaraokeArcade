import { beforeEach, expect, test, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

test('cli flags override env vars and parse numeric levels', async () => {
  process.argv = ['node', 'x', '--data', '/tmp/kp', '-p', '1234', '--scan', 'all',
    '--serverLogLevel', '5', '--rotateKey']

  const { default: env } = await import('./cli.js')

  expect(env.KES_PATH_DATA).toBe('/tmp/kp')
  expect(env.KES_PORT).toBe(1234)
  expect(env.KES_SCAN).toBe('all')
  expect(env.KES_SERVER_LOG_LEVEL).toBe(5)
  expect(env.KES_ROTATE_KEY).toBe(true)
})

test('env log levels keep 0 (off) and treat garbage as unset', async () => {
  process.argv = ['node', 'x']
  vi.stubEnv('KES_SCANNER_CONSOLE_LEVEL', '0')
  vi.stubEnv('KES_SCANNER_LOG_LEVEL', '2')
  vi.stubEnv('KES_SERVER_CONSOLE_LEVEL', 'nope')
  vi.stubEnv('KES_SERVER_LOG_LEVEL', '')

  const { default: env } = await import('./cli.js')

  expect(env.KES_SCANNER_CONSOLE_LEVEL).toBe(0)
  expect(env.KES_SCANNER_LOG_LEVEL).toBe(2)
  expect(env.KES_SERVER_CONSOLE_LEVEL).toBeUndefined()
  expect(env.KES_SERVER_LOG_LEVEL).toBeUndefined()
  vi.unstubAllEnvs()
})
