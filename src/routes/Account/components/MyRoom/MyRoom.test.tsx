// @vitest-environment happy-dom
import React from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MyRoom from './MyRoom'

afterEach(cleanup)

// Modal renders into a native <dialog>; skip its showModal() plumbing
vi.mock('components/Modal/Modal', () => ({
  default: ({ children, title }: { children: React.ReactNode, title: string }) => <div role='dialog' aria-label={title}>{children}</div>,
}))

const leave = ({ isAdmin = false, queued = 2 } = {}) => {
  const ids = Array.from({ length: queued }, (_, i) => i + 1)
  const state = {
    user: { userId: 1, isAdmin, roomId: 9, avatarId: 'p5' },
    rooms: { result: [9], entities: { 9: { roomId: 9, name: 'Loveshack', status: 'play', numUsers: 1 } } },
    points: { leaderboard: [{ userId: 1, name: 'j', avatarId: 'p5', points: 1850 }] },
    queue: { result: ids, entities: Object.fromEntries(ids.map(queueId => [queueId, { queueId, userId: 1 }])) },
    status: { historyJSON: '[]', queueId: -1 },
  }
  const store = { getState: () => state, subscribe: () => () => {}, dispatch: () => {} } as never

  render(<Provider store={store}><MemoryRouter><MyRoom /></MemoryRouter></Provider>)
  fireEvent.click(screen.getByText('Leave'))

  return screen.getByRole('dialog')
}

describe('08c Leave room', () => {
  it('says what stays and what goes, then Leave room before Stay', () => {
    const dialog = leave()

    expect(dialog.getAttribute('aria-label')).toBe('Leave Loveshack?')
    expect(dialog.textContent).toContain('LEAVELOVESHACK?')
    expect(dialog.textContent).toContain('Your 1850 points stay on tonight’s board. Your 2 queued songs will be removed.')
    expect(Array.from(dialog.querySelectorAll('button'), b => b.textContent)).toEqual(['Leave room', 'Stay'])
  })

  it('counts one song as one, and promises no removal when nothing goes', () => {
    expect(leave({ queued: 1 }).textContent).toContain('Your 1 queued song will be removed.')
    cleanup()
    // an admin's songs stay in the queue when they leave
    expect(leave({ isAdmin: true }).textContent).not.toContain('removed')
  })

  it('Leave room goes back to the token slot (01), not straight to 02', () => {
    sessionStorage.setItem('tokenInserted', '1')
    fireEvent.click(within(leave()).getByText('Leave room'))
    expect(sessionStorage.getItem('tokenInserted')).toBeNull()
  })
})
