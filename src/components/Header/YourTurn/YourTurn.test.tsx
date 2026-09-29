// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import YourTurn, { type YourTurnProps } from './YourTurn'

/**
 * The HUD block: who you are, tonight's points, the VS and pause keys, and the
 * Your-turn card in its faces — queued (04), empty (07b), paused (07c) and on
 * stage (undesigned, read in the queued face's grammar).
 */

// vitest globals are off, so RTL's own afterEach hook never registers
afterEach(cleanup)

const read = (props: YourTurnProps) => {
  const { container } = render(<YourTurn {...props} />)
  const meter = screen.queryByRole('meter')

  return {
    legend: container.querySelector('.legend')?.textContent,
    title: container.querySelector('.title')?.textContent,
    wait: container.querySelector('.wait')?.textContent ?? null,
    empty: container.querySelector('.empty')?.textContent,
    hold: container.querySelector('.hold')?.textContent,
    level: meter ? Number(meter.getAttribute('aria-valuenow')) : null,
    // the pause key is a glyph, so its name is the accessible one
    button: screen.getByRole('button', { name: /my songs/ }).getAttribute('aria-label'),
  }
}

describe('YourTurn', () => {
  it('queued: names the next song, the wait, and a meter up the scale', () => {
    expect(read({ wait: '3m', songCount: 1, nextSong: '10,000 Hours', waitLevel: 17 / 24 })).toMatchObject({
      legend: 'Your turn',
      title: '10,000 Hours',
      wait: '3m',
      level: 17 / 24,
      button: 'Pause my songs',
    })
  })

  it('draws the design meter: 24 cells, yellow from cell 20', () => {
    const { container } = render(<YourTurn songCount={1} waitLevel={1} />)
    const cells = container.querySelectorAll('[role=meter] i')

    expect(cells).toHaveLength(24)
    expect(cells[19].classList.contains('peak')).toBe(false)
    expect(cells[20].classList.contains('peak')).toBe(true)
  })

  it('falls back to the rotation when the player has not reported a wait', () => {
    // 1 - (3-1)/4
    expect(read({ position: 3, rotationSize: 4 })).toMatchObject({ level: 0.5, wait: null })
  })

  it('deep in the rotation: the meter floors instead of emptying', () => {
    expect(read({ position: 20, rotationSize: 20 }).level).toBe(0.06)
  })

  it('on stage: the song on stage, "Now", and a full meter', () => {
    expect(read({ isUpNow: true, nowSong: 'Dancing Queen', nextSong: 'Toxic', wait: '4m', position: 1, rotationSize: 6 }))
      .toMatchObject({ legend: 'Your turn', title: 'Dancing Queen', wait: 'Now', level: 1 })
  })

  it('nothing queued: one muted row, no meter and no time', () => {
    expect(read({})).toMatchObject({
      legend: 'Your turn',
      empty: 'No songs queued',
      wait: null,
      level: null,
      button: 'Pause my songs',
    })
  })

  it('a place in the rotation counts as queued even with no count passed', () => {
    expect(read({ wait: '8m', position: 2, rotationSize: 6 }).empty).toBeUndefined()
  })

  it('paused: counts the songs on hold, no meter, and offers the way back', () => {
    expect(read({ isPaused: true, songCount: 2, wait: '4m', position: 2, rotationSize: 6 })).toMatchObject({
      legend: 'Paused',
      hold: '2 songs on hold',
      wait: null,
      level: null,
      button: 'Resume my songs',
    })
  })

  it('paused: one song reads singular', () => {
    expect(read({ isPaused: true, songCount: 1 }).hold).toBe('1 song on hold')
  })

  it('paused beats up-now: a paused singer is not on stage', () => {
    expect(read({ isPaused: true, isUpNow: true, songCount: 1 })).toMatchObject({ legend: 'Paused', level: null })
  })

  it('resumes from the key and from the card', () => {
    const onTogglePaused = vi.fn()
    render(<YourTurn isPaused songCount={2} onTogglePaused={onTogglePaused} />)

    fireEvent.click(screen.getByRole('button', { name: 'Resume my songs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(onTogglePaused).toHaveBeenCalledTimes(2)
  })

  it('reads the name, tonight\'s points raw and the place as an ordinal', () => {
    const { container } = render(<YourTurn name='jumpinjammer' points={1550} rank={2} />)

    expect(container.querySelector('.name')?.textContent).toBe('jumpinjammer')
    expect(container.querySelector('.points')?.textContent).toBe('1550')
    expect(container.querySelector('.rank')?.textContent).toBe('2nd')
  })

  it('draws no place for somebody not on the board', () => {
    const { container } = render(<YourTurn points={0} rank={null} />)

    expect(container.querySelector('.rank')).toBeNull()
  })

  it('draws the portrait-80 tile', () => {
    const { container } = render(<YourTurn avatarId='default/screamer' />)

    expect(container.querySelector('.avatar img')?.getAttribute('src')).toMatch(/portrait-80/)
  })

  it('always draws the VS key, and presses through to the caller', () => {
    const onBattle = vi.fn()
    render(<YourTurn onBattle={onBattle} />)

    const key = screen.getByRole('button', { name: 'Start a singer battle' })
    expect(key.textContent).toBe('VS')
    expect(key.hasAttribute('disabled')).toBe(false)

    fireEvent.click(key)
    expect(onBattle).toHaveBeenCalledTimes(1)
  })
})
