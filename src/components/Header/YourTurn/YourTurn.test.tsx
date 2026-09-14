// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import YourTurn, { type YourTurnProps } from './YourTurn'

/**
 * The only status surface in the product, and the answer to the one question a
 * singer opens their phone to ask. Four states, each with its own headline,
 * label and meter level — none of which anything else asserts.
 */

// vitest globals are off, so RTL's own afterEach hook never registers
afterEach(cleanup)

const read = (props: YourTurnProps) => {
  const { container } = render(<YourTurn {...props} />)
  const meter = screen.getByRole('meter')

  return {
    headline: container.querySelector('.wait')?.textContent,
    label: container.querySelector('.label')?.textContent,
    level: Number(meter.getAttribute('aria-valuenow')),
    // the pause key is icon-only, so its name is the accessible one. Matched by
    // name rather than by being the only button: the strip carries a second key
    // whenever the room offers battles, and a bare getByRole('button') throws
    // "found multiple elements" and fails every test that shares this helper.
    button: screen.getByRole('button', { name: /my songs/ }).getAttribute('aria-label'),
    // every state is a tinted well; the class names which tint
    standby: container.firstElementChild?.classList.contains('standby'),
    onStage: container.firstElementChild?.classList.contains('onStage'),
  }
}

describe('YourTurn', () => {
  it('up now: pegs the meter and says so', () => {
    expect(read({ isUpNow: true, wait: '4 min', position: 1, rotationSize: 6 })).toMatchObject({
      headline: 'Now',
      label: 'you are on stage',
      level: 1,
    })
  })

  it('up next: shows the wait, the place, and a meter well up the scale', () => {
    expect(read({ wait: '4 min', position: 3, rotationSize: 4 })).toMatchObject({
      headline: '4 min',
      label: '3 of 4 in the rotation',
      // 1 - (3-1)/4
      level: 0.5,
    })
  })

  it('deep in the rotation: the meter floors instead of emptying', () => {
    // last of twenty is 0.05 raw, which reads as paused; the floor keeps a
    // single segment lit so the meter still reads as "in the rotation"
    expect(read({ wait: '48 min', position: 20, rotationSize: 20 })).toMatchObject({
      headline: '48 min',
      label: '20 of 20 in the rotation',
      level: 0.06,
    })
  })

  it('paused: empties the meter completely and offers the way back', () => {
    expect(read({ isPaused: true, wait: '4 min', position: 2, rotationSize: 6 })).toMatchObject({
      headline: 'Paused',
      label: 'you are out of the rotation',
      level: 0,
      button: 'Resume my songs',
    })
  })

  it('paused beats up-now: a paused singer is not on stage', () => {
    expect(read({ isPaused: true, isUpNow: true })).toMatchObject({
      headline: 'Paused',
      level: 0,
    })
  })

  // The strip is on screen from the moment somebody walks in now, because the
  // Battle key rides in it, so this is the first state most people ever see.
  // It used to sit at half scale in standby teal, which was harmless when you
  // only got here by queueing something and unqueueing it again — and reads as
  // a promise of a turn when it is the thing greeting you at the door.
  it('nothing queued: no wait to show, and an empty meter rather than a promise', () => {
    expect(read({})).toMatchObject({
      headline: '--',
      label: 'nothing queued',
      level: 0,
      button: 'Pause my songs',
    })
  })

  it('nothing queued is idle, not armed: no standby tint', () => {
    expect(read({}).standby).toBe(false)
  })

  // songCount is what Header actually passes; position is what the older
  // fixtures set. Either one means there is a turn coming, and a singer with a
  // turn coming must not be mistaken for somebody who has just walked in.
  // One render per test: read() does not clean up after itself, so two calls
  // in one test leave two meters in the document and getByRole throws.
  it('a place in the rotation counts as queued even with no count passed', () => {
    expect(read({ wait: '8 min', position: 2, rotationSize: 6 }).standby).toBe(true)
  })

  it('a song count counts as queued even with no place passed', () => {
    expect(read({ songCount: 1, wait: '8 min' }).standby).toBe(true)
  })

  it('counts songs in words a human uses', () => {
    const count = (songCount: number) => {
      const { container } = render(<YourTurn songCount={songCount} />)
      const text = container.querySelector('.songCount')?.textContent
      cleanup()
      return text
    }

    expect(count(1)).toBe('1 song')
    expect(count(0)).toBe('0 songs')
    expect(count(4)).toBe('4 songs')
  })

  // "armed but not running" is the same state the library gives a queued song,
  // and it says it in --standby. Amber is reserved for the live channel.
  it('waits in standby teal', () => {
    expect(read({ wait: '8 min', position: 2, rotationSize: 6 }).standby).toBe(true)
  })

  it('drops standby once on stage', () => {
    expect(read({ isUpNow: true, position: 1, rotationSize: 6 }).standby).toBe(false)
  })

  it('drops standby when paused', () => {
    expect(read({ isPaused: true, position: 2, rotationSize: 6 }).standby).toBe(false)
  })

  it('wears the live amber well on stage', () => {
    expect(read({ isUpNow: true, position: 1, rotationSize: 6 }).onStage).toBe(true)
  })

  it('is not on stage while paused, even when up', () => {
    // paused wins: a dead channel must not read as the live one
    expect(read({ isUpNow: true, isPaused: true }).onStage).toBe(false)
  })

  it('names the next song rather than a place in the rotation', () => {
    // a singer wants to know what they are waiting for, not their index
    expect(read({ wait: '8 min', position: 2, rotationSize: 6, nextSong: 'Bohemian Rhapsody' }))
      .toMatchObject({ label: 'Bohemian Rhapsody' })
  })

  it('falls back to the rotation when the title is not loaded yet', () => {
    expect(read({ wait: '8 min', position: 2, rotationSize: 6 }))
      .toMatchObject({ label: '2 of 6 in the rotation' })
  })

  it('still says on stage over any next song', () => {
    expect(read({ isUpNow: true, nextSong: 'Dancing Queen' }).label).toBe('you are on stage')
  })

  it('still says paused over any next song', () => {
    expect(read({ isPaused: true, nextSong: 'Dancing Queen' }).label).toBe('you are out of the rotation')
  })

  /**
   * The Battle key. It shares its slot with the song count and only one of them
   * fits — see the note in YourTurn.tsx — so these pin both halves of that
   * trade, and that the key is only there when there is something behind it.
   */
  it('carries a battle key that names itself', () => {
    render(<YourTurn songCount={2} isBattleEnabled onBattle={() => {}} />)

    const key = screen.getByRole('button', { name: 'Start a singer battle' })
    expect(key.hasAttribute('disabled')).toBe(false)
  })

  it('spends the song count on the key rather than wrapping the strip', () => {
    const { container } = render(<YourTurn songCount={2} isBattleEnabled onBattle={() => {}} />)

    expect(container.querySelector('.songCount')).toBeNull()
  })

  it('keeps the count when there is no battle key to show', () => {
    const { container } = render(<YourTurn songCount={2} />)

    expect(container.querySelector('.songCount')?.textContent).toBe('2 songs')
    expect(screen.queryByRole('button', { name: /battle/i })).toBeNull()
  })

  it('leaves the key dead, and says why, when the room has battles off', () => {
    render(<YourTurn songCount={2} onBattle={() => {}} />)

    const key = screen.getByRole('button', { name: 'Singer battles are switched off for this room' })
    expect(key.hasAttribute('disabled')).toBe(true)
    expect(key.getAttribute('title')).toBe('Singer battles are switched off for this room')
  })

  it('opens the roster on a press', () => {
    const onBattle = vi.fn()
    render(<YourTurn songCount={2} isBattleEnabled onBattle={onBattle} />)

    fireEvent.click(screen.getByRole('button', { name: 'Start a singer battle' }))
    expect(onBattle).toHaveBeenCalledTimes(1)
  })
})
