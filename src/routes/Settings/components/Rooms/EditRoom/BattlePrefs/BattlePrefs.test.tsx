// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import BattlePrefs from './BattlePrefs'

/**
 * Battles are switched off at the source while the feature is finished.
 *
 * The test is here because "off" has to mean off in two directions: a host
 * cannot turn it on, and a room that already had it on is not quietly cleared
 * out from under them. The second is the one a refactor would break without
 * anybody noticing, since nothing on screen would look different.
 */

afterEach(cleanup)

describe('the battle room setting', () => {
  it('cannot be switched on', () => {
    const onChange = vi.fn()
    render(<BattlePrefs prefs={{}} onChange={onChange} />)

    const checkbox = screen.getByLabelText('Allow song battles') as HTMLInputElement

    expect(checkbox.disabled).toBe(true)
    expect(checkbox.checked).toBe(false)

    fireEvent.click(checkbox)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('says why, rather than dimming with no explanation', () => {
    render(<BattlePrefs prefs={{}} onChange={vi.fn()} />)

    expect(screen.getByText(/Battles are turned off/)).toBeTruthy()
  })

  // the pref is untouched, so switching this back on restores the rooms that
  // already had it rather than making every host set it again
  it('still reads a room that already had battles on', () => {
    render(<BattlePrefs prefs={{ battle: { isEnabled: true } }} onChange={vi.fn()} />)

    const checkbox = screen.getByLabelText('Allow song battles') as HTMLInputElement

    expect(checkbox.checked).toBe(true)
    expect(checkbox.disabled).toBe(true)
  })

  it('keeps the crowd-scoring note for a room that has them on', () => {
    render(<BattlePrefs prefs={{ battle: { isEnabled: true } }} onChange={vi.fn()} />)

    expect(screen.getByText(/Crowd scoring listens through the microphone/)).toBeTruthy()
  })
})
