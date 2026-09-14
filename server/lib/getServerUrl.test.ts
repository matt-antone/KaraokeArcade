import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import getServerUrl from './getServerUrl.js'
import getIPAddress from './getIPAddress.js'

vi.mock('./getIPAddress.js', () => ({ default: vi.fn(() => '192.168.86.235') }))

const setEnv = (key: string, value?: string) => {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

beforeEach(() => {
  setEnv('KES_SERVER_URL', undefined)
  setEnv('KES_URL_PATH', undefined)
  vi.mocked(getIPAddress).mockReturnValue('192.168.86.235')
})

afterEach(() => {
  setEnv('KES_SERVER_URL', undefined)
  setEnv('KES_URL_PATH', undefined)
})

describe('getServerUrl', () => {
  it('falls back to the LAN address and port', () => {
    expect(getServerUrl('8080')).toBe('http://192.168.86.235:8080/')
  })

  it('omits the port for 80, and when there is none', () => {
    expect(getServerUrl('80')).toBe('http://192.168.86.235/')
    expect(getServerUrl(undefined)).toBe('http://192.168.86.235/')
  })

  it('carries the base path into the fallback', () => {
    setEnv('KES_URL_PATH', '/kp')
    expect(getServerUrl('8080')).toBe('http://192.168.86.235:8080/kp/')
  })

  it('is undefined with no external IPv4, so the player uses its own location', () => {
    vi.mocked(getIPAddress).mockReturnValue(undefined)
    expect(getServerUrl('8080')).toBeUndefined()
  })

  it('prefers an override, so an install survives changing networks', () => {
    setEnv('KES_SERVER_URL', 'http://karaokearcade.local:8080')
    expect(getServerUrl('8080')).toBe('http://karaokearcade.local:8080/')
  })

  it('normalizes the override to a trailing slash, as the fallback is', () => {
    setEnv('KES_SERVER_URL', 'http://karaokearcade.local:8080/kp')
    expect(getServerUrl('8080')).toBe('http://karaokearcade.local:8080/kp')
  })

  it('ignores the port and base path once overridden', () => {
    setEnv('KES_URL_PATH', '/kp')
    setEnv('KES_SERVER_URL', 'https://party.example.com/')
    expect(getServerUrl('8080')).toBe('https://party.example.com/')
  })

  // new URL() parses "karaokearcade.local:8080" without complaint, taking
  // "karaokearcade.local:" for the scheme, so try/catch alone lets it through
  it('falls back on a host:port missing its scheme, rather than poisoning every QR', () => {
    setEnv('KES_SERVER_URL', 'karaokearcade.local:8080')
    expect(getServerUrl('8080')).toBe('http://192.168.86.235:8080/')
  })

  it('falls back on a non-http scheme', () => {
    setEnv('KES_SERVER_URL', 'ftp://karaokearcade.local')
    expect(getServerUrl('8080')).toBe('http://192.168.86.235:8080/')
  })

  it('falls back on outright garbage', () => {
    setEnv('KES_SERVER_URL', 'not a url')
    expect(getServerUrl('8080')).toBe('http://192.168.86.235:8080/')
  })

  it('treats a blank override as unset', () => {
    setEnv('KES_SERVER_URL', '   ')
    expect(getServerUrl('8080')).toBe('http://192.168.86.235:8080/')
  })
})
