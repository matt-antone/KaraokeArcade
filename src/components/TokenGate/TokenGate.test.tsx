// @vitest-environment happy-dom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import TokenGate from './TokenGate'
import { isTokenInserted } from './tokenInserted'

/**
 * The slot is cosmetic, but it is still the one thing between a stranger and
 * the join screen: let go over the slot and it opens, anywhere else and the
 * token goes home. A keyboard can put it in too, and once in it stays in for
 * the session.
 */

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

/** Lays the slot at a fixed spot and the token wherever the test drops it. */
const layOut = (tokenAt: { x: number, y: number }) => {
  const slot = screen.getByAltText('Token slot')
  const token = screen.getByRole('button', { name: 'Insert token' })
  slot.getBoundingClientRect = () => rect(200, 0, 136, 290)
  token.getBoundingClientRect = () => rect(tokenAt.x - 58, tokenAt.y - 58, 116, 116)
  return token
}

const drag = (token: HTMLElement, to: { x: number, y: number }) => {
  fireEvent.pointerDown(token, { pointerId: 1, clientX: 100, clientY: 600 })
  fireEvent.pointerMove(token, { pointerId: 1, clientX: to.x, clientY: to.y })
  fireEvent.pointerUp(token, { pointerId: 1, clientX: to.x, clientY: to.y })
}

beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('TokenGate', () => {
  it('unlocks when the token is let go over the slot, and remembers it', () => {
    const onUnlock = vi.fn()
    render(<TokenGate onUnlock={onUnlock} />)

    const where = { x: 268, y: 140 }
    drag(layOut(where), where)
    act(() => vi.runAllTimers())

    expect(onUnlock).toHaveBeenCalledOnce()
    expect(isTokenInserted()).toBe(true)
  })

  it('springs back when let go anywhere else', () => {
    const onUnlock = vi.fn()
    render(<TokenGate onUnlock={onUnlock} />)

    const where = { x: 60, y: 500 }
    const token = layOut(where)
    drag(token, where)
    act(() => vi.runAllTimers())

    expect(onUnlock).not.toHaveBeenCalled()
    expect(isTokenInserted()).toBe(false)
    expect(token.style.getPropertyValue('--dx')).toBe('0px')
  })

  it('goes in from the keyboard, but not from a bare tap', () => {
    const onUnlock = vi.fn()
    render(<TokenGate onUnlock={onUnlock} />)
    const token = screen.getByRole('button', { name: 'Insert token' })

    // a pointer tap reports how many clicks it was; the drag is the game
    fireEvent.click(token, { detail: 1 })
    act(() => vi.runAllTimers())
    expect(onUnlock).not.toHaveBeenCalled()

    // Enter, Space and a screen reader's activate arrive as detail 0
    fireEvent.click(token, { detail: 0 })
    act(() => vi.runAllTimers())
    expect(onUnlock).toHaveBeenCalledOnce()
  })
})
