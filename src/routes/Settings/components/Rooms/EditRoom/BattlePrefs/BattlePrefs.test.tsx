// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import BattlePrefs from './BattlePrefs'

/**
 * Singer Battle is a per-room setting, off until a host asks for it.
 *
 * Opt-in rather than opt-out because of what a battle costs: one queue row and
 * about five minutes of the room's evening spent on two people. A room that
 * gets one it never asked for has lost a turn it cannot get back, so the
 * default has to be the quiet one.
 *
 * What a refactor would plausibly break here is the judging half — it only
 * exists while the feature is on, so it is the part that silently disappears
 * when the enclosing condition is got wrong, with nothing on screen to say so.
 */

afterEach(cleanup)

describe('the battle room setting', () => {
  it('is off until a host turns it on, and then reports it', () => {
    const onChange = vi.fn()
    render(<BattlePrefs prefs={{}} onChange={onChange} />)

    const checkbox = screen.getByLabelText('Allow singer battles') as HTMLInputElement

    expect(checkbox.disabled).toBe(false)
    expect(checkbox.checked).toBe(false)

    fireEvent.click(checkbox)

    // the whole prefs object back, not just the one key: EditRoom writes what
    // it is handed, so a partial here drops every other setting in the room
    expect(onChange).toHaveBeenCalledWith({ battle: { isEnabled: true } })
  })

  it('says what a battle costs the room before a host agrees to one', () => {
    render(<BattlePrefs prefs={{}} onChange={vi.fn()} />)

    expect(screen.getByText(/uses a single place in the queue/)).toBeTruthy()
  })

  it('can be switched back off', () => {
    const onChange = vi.fn()
    render(<BattlePrefs prefs={{ battle: { isEnabled: true } }} onChange={onChange} />)

    const checkbox = screen.getByLabelText('Allow singer battles') as HTMLInputElement

    expect(checkbox.checked).toBe(true)
    expect(checkbox.disabled).toBe(false)

    fireEvent.click(checkbox)
    expect(onChange).toHaveBeenCalledWith({ battle: { isEnabled: false } })
  })

  // the judging choice is a separate setting and stays reachable: a room that
  // already has battles on can still say how they are decided
  it('keeps the judging notes for a room that has them on', () => {
    render(<BattlePrefs prefs={{ battle: { isEnabled: true } }} onChange={vi.fn()} />)

    // ballot is the default, so that is the note an enabled room opens on
    expect(screen.getByText(/Everyone in the room votes on their own phone/)).toBeTruthy()

    cleanup()
    render(<BattlePrefs prefs={{ battle: { isEnabled: true, judging: 'crowd' } }} onChange={vi.fn()} />)

    expect(screen.getByText(/Crowd scoring listens through the microphone/)).toBeTruthy()
  })
})
