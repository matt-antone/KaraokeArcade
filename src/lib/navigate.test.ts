import { afterEach, describe, expect, it, vi } from 'vitest'
import { navigate, setNavigate } from './navigate'

/**
 * Module-level state with two ends that never import each other, which is the
 * whole point of it — and also the thing that makes it worth a test. If either
 * end silently stops calling in, a sign-in redirect goes nowhere and nothing
 * throws.
 */

afterEach(() => {
  setNavigate(null as never)
})

describe('navigate', () => {
  it('hands the destination to whatever the router registered', () => {
    const spy = vi.fn()
    setNavigate(spy)

    navigate('/queue')

    expect(spy).toHaveBeenCalledWith('/queue')
  })

  // the caller is a thunk running from a tap, so the router is always up by
  // then — but a missed redirect is a better failure than a thrown one
  it('does nothing before a router has registered', () => {
    expect(() => navigate('/queue')).not.toThrow()
  })
})
