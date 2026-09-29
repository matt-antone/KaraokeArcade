// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import SongItem from './SongItem'

/** The library row (Arcade Flow v2 04 / 04b / 04d). */
const renderRow = (props: Partial<React.ComponentProps<typeof SongItem>> = {}) => {
  const handlers = { onSongQueue: vi.fn(), onSongDequeue: vi.fn(), onSongStarClick: vi.fn() }
  render(
    <SongItem
      songId={7}
      artist='Garbage'
      title='#1 Crush'
      tags={['rock', '1990s']}
      duration={228}
      isPlayed={false}
      isStarred={false}
      isUpcoming={false}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

describe('SongItem', () => {
  afterEach(cleanup)

  it('takes a tap anywhere on the row, the tag included (04)', () => {
    const { onSongDequeue } = renderRow({ isUpcoming: true, myQueueId: 42 })
    fireEvent.click(screen.getByText('Tap to remove'))
    fireEvent.click(screen.getByText('3:48'))
    expect(onSongDequeue).toHaveBeenCalledTimes(2)
    expect(onSongDequeue).toHaveBeenCalledWith(42)
  })

  it('keeps the star a key of its own', () => {
    const { onSongQueue, onSongStarClick } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'star' }))
    expect(onSongStarClick).toHaveBeenCalledWith(7)
    expect(onSongQueue).not.toHaveBeenCalled()
  })

  it('draws every starred row alike, queued or not (04d)', () => {
    renderRow({ isUpcoming: true, isStarred: true, isStarredView: true })
    expect(screen.queryByText('Queued')).toBeNull()
    expect(screen.getByRole('button', { name: 'unstar' })).toBeTruthy()
  })

  it('carries no star on an unstarred search result (04b)', () => {
    renderRow({ isSearchView: true })
    expect(screen.queryByRole('button', { name: 'star' })).toBeNull()
  })
})
