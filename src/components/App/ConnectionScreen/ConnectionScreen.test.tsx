// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ConnectionScreen from './ConnectionScreen'

afterEach(cleanup)

describe('ConnectionScreen', () => {
  it('names the attempt and retries on demand when the connection is lost', () => {
    const onRetry = vi.fn()
    render(<ConnectionScreen variant='lost' room='Loveshack' attempt={2} onRetry={onRetry} />)

    expect(screen.getByText(/Reconnecting · try 2/)).toBeTruthy()
    expect(screen.getByText('Loveshack')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry now' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows the loading spinner and no retry before the socket has answered', () => {
    render(<ConnectionScreen variant='loading' />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
