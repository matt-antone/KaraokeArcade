// @vitest-environment happy-dom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import InstallHint from './InstallHint'

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME = `${IPHONE_SAFARI.replace('Safari/604.1', 'CriOS/126.0 Mobile/15E148 Safari/604.1')}`
const IPAD_OS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const DESKTOP_SAFARI = IPAD_OS

const set = (key: string, value: unknown, target: object = navigator) =>
  Object.defineProperty(target, key, { value, configurable: true })

const setStandalone = (matches: boolean) =>
  set('matchMedia', () => ({ matches, media: '', addEventListener () {}, removeEventListener () {} }), window)

const setHostname = (hostname: string) =>
  set('location', { ...window.location, hostname }, window)

beforeEach(() => {
  localStorage.clear()
  set('userAgent', IPHONE_SAFARI)
  set('maxTouchPoints', 5)
  set('standalone', undefined)
  setStandalone(false)
  setHostname('karaokearcade.local')
})

afterEach(cleanup)

describe('InstallHint', () => {
  it('tells an uninstalled iPhone where the Share item is', () => {
    render(<InstallHint />)

    expect(screen.getByText('Add to Home Screen')).toBeTruthy()
    expect(screen.getByText(/Tap Share in Safari/)).toBeTruthy()
  })

  it('stays hidden once the app is running standalone', () => {
    setStandalone(true)
    render(<InstallHint />)

    expect(screen.queryByText('Add to Home Screen')).toBeNull()
  })

  it('stays hidden on an older iOS that only sets navigator.standalone', () => {
    set('standalone', true)
    render(<InstallHint />)

    expect(screen.queryByText('Add to Home Screen')).toBeNull()
  })

  it('stays hidden in a browser that cannot add to the home screen', () => {
    set('userAgent', IPHONE_CHROME)
    render(<InstallHint />)

    expect(screen.queryByText('Add to Home Screen')).toBeNull()
  })

  it('stays hidden on a desktop Safari, which has no Add to Home Screen', () => {
    set('userAgent', DESKTOP_SAFARI)
    set('maxTouchPoints', 0)
    render(<InstallHint />)

    expect(screen.queryByText('Add to Home Screen')).toBeNull()
  })

  it('shows on an iPad, which reports itself as a Macintosh', () => {
    set('userAgent', IPAD_OS)
    set('maxTouchPoints', 5)
    render(<InstallHint />)

    expect(screen.getByText('Add to Home Screen')).toBeTruthy()
  })

  // the join QR hands out a LAN IP by default, so this is how every real guest
  // arrives; a stale icon just sends them back to rescanning the QR
  it('shows on a private LAN IPv4, which is how guests actually arrive', () => {
    setHostname('192.168.86.235')
    render(<InstallHint />)

    expect(screen.getByText('Add to Home Screen')).toBeTruthy()
  })

  // routable, so a frozen icon can reach an unrelated machine rather than fail
  it('stays hidden on a public IPv4', () => {
    setHostname('203.0.113.9')
    render(<InstallHint />)

    expect(screen.queryByText('Add to Home Screen')).toBeNull()
  })

  it('stays hidden on an IPv6 literal', () => {
    setHostname('[fe80::1]')
    render(<InstallHint />)

    expect(screen.queryByText('Add to Home Screen')).toBeNull()
  })

  it('shows on a hostname, which follows the server between networks', () => {
    setHostname('MATTHEWs-MacBook-Pro.local')
    render(<InstallHint />)

    expect(screen.getByText('Add to Home Screen')).toBeTruthy()
  })

  it('shows on localhost, which is stable for whoever is on that machine', () => {
    setHostname('localhost')
    render(<InstallHint />)

    expect(screen.getByText('Add to Home Screen')).toBeTruthy()
  })

  it('stays dismissed across a reload', () => {
    const { unmount } = render(<InstallHint />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText('Add to Home Screen')).toBeNull()

    unmount()
    render(<InstallHint />)
    expect(screen.queryByText('Add to Home Screen')).toBeNull()
  })

  it('still renders when storage access throws', () => {
    const storage = Object.getOwnPropertyDescriptor(window, 'localStorage')
    const denied = () => {
      throw new Error('denied')
    }
    set('localStorage', { getItem: denied, setItem: denied }, window)

    expect(() => render(<InstallHint />)).not.toThrow()
    expect(screen.getByText('Add to Home Screen')).toBeTruthy()

    // dismissal can't persist, but it must still dismiss
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText('Add to Home Screen')).toBeNull()

    if (storage) Object.defineProperty(window, 'localStorage', storage)
  })
})
