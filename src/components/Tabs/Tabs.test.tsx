// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Tabs from './Tabs'

// vitest globals are off, so RTL's own afterEach hook never registers
afterEach(cleanup)

const tabs = [
  { id: 'queue', label: 'Queue', count: 4 },
  { id: 'me', label: 'Me', count: 0 },
  { id: 'history', label: 'History' },
]

describe('Tabs', () => {
  it('marks exactly one tab selected, for assistive tech as well as the eye', () => {
    render(<Tabs tabs={tabs} active='me' />)

    const selected = screen.getAllByRole('tab').filter(t => t.getAttribute('aria-selected') === 'true')
    expect(selected.map(t => t.textContent)).toEqual(['Me 0'])
    expect(selected[0].className).toContain('active')
  })

  it('shows a zero count rather than hiding it', () => {
    // "Me 0" is information; a Me tab with no number reads as not yet loaded
    render(<Tabs tabs={tabs} active='queue' />)

    expect(screen.getByRole('tab', { name: 'Me 0' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'History' }).querySelector('.count')).toBeNull()
  })

  it('reports the tab that was pressed', () => {
    const onChange = vi.fn()
    render(<Tabs tabs={tabs} active='queue' onChange={onChange} />)

    fireEvent.click(screen.getByRole('tab', { name: 'History' }))

    expect(onChange).toHaveBeenCalledWith('history')
  })
})
