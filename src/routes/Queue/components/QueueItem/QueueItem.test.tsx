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
  errorMessage: '',
  isCurrent: false,
  isErrored: false,
  isMovable: true,
  isOwner: false,
  isPaused: false,
  isPlayed: false,
  isPlaying: true,
  isRemovable: true,
  isReplayable: true,
  isSkippable: true,
  isStarred: false,
  isTunable: false,
  isUpcoming: false,
  pctPlayed: 0,
  queueId: 1,
  songId: 2,
  starCount: 0,
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
    face: container.querySelector('[style*="--progress"]') as HTMLElement,
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
      .toBe('assets/battle/fighters/halloween/hex/views/portrait-34.png')
  })

  it('draws the first playable fighter for an account that has not picked', () => {
    const { container } = renderItem({ userAvatarId: null })

    expect(container.querySelector('img')?.getAttribute('src'))
      .toBe('assets/battle/fighters/default/belter/views/portrait-34.png')
  })
})

describe('QueueItem actions', () => {
  it('offers every permitted action on a live row', () => {
    renderItem()

    for (const label of ['Top', 'Replay', 'Skip', 'Remove']) {
      expect(screen.getByLabelText(label)).toBeTruthy()
    }
  })

  it('locks a played row: no actions, and no travel to reveal them', () => {
    // every permission still granted — being played is what takes them away
    const { container, slider } = renderItem({ isPlayed: true })

    expect(container.querySelector('.actions')).toBeNull()
    expect(slider.style.transform).toBe(`translateX(${0}px)`)
    for (const label of ['Top', 'Replay', 'Skip', 'Remove']) {
      expect(screen.queryByLabelText(label)).toBeNull()
    }
  })

  it('sizes the reveal to the permissions actually granted', () => {
    const { container } = renderItem({ isMovable: false, isReplayable: false, isSkippable: false })

    expect(container.querySelectorAll('.action')).toHaveLength(1)
    expect(container.querySelector<HTMLElement>('.actions')?.style
      .getPropertyValue('--swipe-action-width')).toBe(`${SWIPE_ACTION_WIDTH}px`)
  })
})

describe('QueueItem wait chip', () => {
  it('reads NOW on the row that is playing', () => {
    const { chip } = renderItem({ isCurrent: true, pctPlayed: 40 })

    expect(chip?.textContent).toBe('NOW')
    expect(chip?.className).toContain('waitIsCurrent')
  })

  it('reads the wait on an upcoming row', () => {
    const { chip } = renderItem({ isUpcoming: true, wait: '4 min' })

    expect(chip?.textContent).toBe('4 min')
    expect(chip?.className).not.toContain('waitIsCurrent')
  })

  it('shows no chip on a row that is neither current nor waiting', () => {
    expect(renderItem({ isUpcoming: true }).chip).toBeNull()
    expect(renderItem().chip).toBeNull()
  })
})

describe('QueueItem star', () => {
  it('shows the star by default', () => {
    renderItem()
    expect(screen.getByLabelText('star')).toBeTruthy()
  })

  it('hides the star on the Me tab, where every row is already yours', () => {
    renderItem({ showStar: false })
    expect(screen.queryByLabelText('star')).toBeNull()
    expect(screen.queryByLabelText('unstar')).toBeNull()
  })

  it('keeps the star on a played row — the one control a locked row keeps', () => {
    renderItem({ isPlayed: true, isStarred: true })
    expect(screen.getByLabelText('unstar')).toBeTruthy()
  })
})

describe('QueueItem spent state', () => {
  it('dims a spent row by class, never by inline opacity', () => {
    for (const spent of [{ isPlayed: true }, { isPaused: true }]) {
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
