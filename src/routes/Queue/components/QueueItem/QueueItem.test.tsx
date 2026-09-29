// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import QueueItem from './QueueItem'
import { SWIPE_ACTION_WIDTH } from 'components/SwipeRow/constants'

/** the row only ever dispatches; nothing here reads the store */
vi.mock('store/hooks', () => ({ useAppDispatch: () => () => {} }))

// vitest globals are off, so RTL's own afterEach hook never registers
afterEach(cleanup)

const base = {
  artist: 'Cheap Trick',
  isMovable: true,
  isOwner: false,
  isPaused: false,
  isPlayed: false,
  isRemovable: true,
  isTunable: false,
  points: 0,
  queueId: 1,
  songId: 2,
  title: 'Surrender',
  userDateUpdated: 0,
  userDisplayName: 'Robin',
  userAvatarId: 'p3',
  userId: 3,
  onMoveClick: () => {},
}

const renderItem = (props: Partial<typeof base> & Record<string, unknown> = {}) => {
  const { container } = render(<QueueItem {...base} {...props} />)

  return {
    container,
    /** the row face — the only opaque layer over the action keys */
    face: container.querySelector('.slider > div') as HTMLElement,
    slider: container.querySelector('.slider') as HTMLElement,
    chip: container.querySelector('.wait'),
  }
}

describe('QueueItem', () => {
  it('draws the singer as the character on their account', () => {
    // An ordinary row follows the account, so a singer who changes character
    // mid-night changes on every row they own. Only a battle row, which keeps
    // its own snapshot, does not.
    const { container } = renderItem({ userAvatarId: 'halloween/hex' })

    expect(container.querySelector('img')?.getAttribute('src'))
      .toBe('assets/battle/fighters/halloween/hex/views/portrait-80.png')
  })

  it('draws the first playable fighter for an account that has not picked', () => {
    const { container } = renderItem({ userAvatarId: null })

    expect(container.querySelector('img')?.getAttribute('src'))
      .toBe('assets/battle/fighters/default/belter/views/portrait-80.png')
  })
})

describe('QueueItem face (07)', () => {
  it('names the singer with their points tonight', () => {
    renderItem({ userDisplayName: 'jumpinjammer', points: 2150 })

    expect(screen.getByText('jumpinjammer · 2150')).toBeTruthy()
  })

  it('carries nothing but place, face, words and wait: no star, no key, no handle', () => {
    const { face } = renderItem({ isUpcoming: true, position: 1, wait: '3m', keyChange: 3 })

    expect(screen.queryByLabelText('star')).toBeNull()
    expect(screen.queryByText('key +3')).toBeNull()
    // the swipe keys under the row have icons; the face has none
    expect(face.querySelector('svg')).toBeNull()
    expect(face.textContent).toBe('1SurrenderCheap TrickRobin · 03m')
  })
})

describe('QueueItem actions', () => {
  it('offers every permitted action on a live row', () => {
    renderItem()

    for (const label of ['Top', 'Remove']) {
      expect(screen.getByLabelText(label)).toBeTruthy()
    }
  })

  it('locks a played row: no actions, and no travel to reveal them', () => {
    // every permission still granted — being played is what takes them away
    const { container, slider } = renderItem({ isPlayed: true })

    expect(container.querySelector('.actions')).toBeNull()
    expect(slider.style.transform).toBe(`translateX(${0}px)`)
    for (const label of ['Top', 'Remove']) {
      expect(screen.queryByLabelText(label)).toBeNull()
    }
  })

  it('sizes the reveal to the permissions actually granted', () => {
    const { container } = renderItem({ isMovable: false })

    expect(container.querySelectorAll('.action')).toHaveLength(1)
    expect(container.querySelector<HTMLElement>('.actions')?.style
      .getPropertyValue('--swipe-action-width')).toBe(`${SWIPE_ACTION_WIDTH}px`)
  })
})

describe('QueueItem wait chip', () => {
  it('reads the wait on an upcoming row', () => {
    const { chip } = renderItem({ isUpcoming: true, wait: '4 min' })

    expect(chip?.textContent).toBe('4 min')
    expect(chip?.className).not.toContain('held')
  })

  it('reads Hold, in the held colour, on a paused singer\'s row (07c)', () => {
    const { chip, face } = renderItem({ isUpcoming: true, isPaused: true })

    expect(chip?.textContent).toBe('Hold')
    expect(chip?.className).toContain('held')
    // held rows keep their place and their colour; only the wait changes
    expect(face.className).not.toContain('spent')
  })

  it('shows no chip on a row that is not waiting', () => {
    expect(renderItem({ isUpcoming: true }).chip).toBeNull()
    expect(renderItem({ isPlayed: true }).chip).toBeNull()
  })
})

describe('QueueItem position', () => {
  it('prints its place in line when given one', () => {
    const { container } = renderItem({ isUpcoming: true, position: 3 })

    expect(container.querySelector('.position')?.textContent).toBe('3')
  })

  it('prints nothing on a row with no place in line', () => {
    expect(renderItem({ isPlayed: true }).container.querySelector('.position')).toBeNull()
  })
})

describe('QueueItem spent state', () => {
  it('dims a spent row by class, never by inline opacity', () => {
    for (const spent of [{ isPlayed: true }]) {
      const { face } = renderItem(spent)

      expect(face.className).toContain('spent')
      // the face is the only opaque layer over the action keys underneath;
      // fading it with inline opacity would show them through a closed row
      expect(face.style.opacity).toBe('')
      cleanup()
    }
  })

  it('leaves a live row undimmed', () => {
    expect(renderItem().face.className).not.toContain('spent')
  })
})
