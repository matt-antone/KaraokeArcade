// @vitest-environment happy-dom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import RoomTransport from './RoomTransport'

const dispatch = vi.fn()

vi.mock('store/hooks', () => ({
  useAppDispatch: () => dispatch,
}))

vi.mock('store/modules/rooms', () => ({
  setRoomStatus: vi.fn(arg => ({ type: 'rooms/SET_STATUS', payload: arg })),
}))

const { setRoomStatus } = await import('store/modules/rooms')

const renderTransport = (status: 'play' | 'paused' | 'stopped' = 'play') =>
  render(<RoomTransport roomId={7} name='LOVESHACK' status={status} />)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('RoomTransport', () => {
  // The running key offers what pressing it does, not where the room is, so
  // only one of play and pause is ever on screen.
  it('offers pause while the room is playing', () => {
    renderTransport('play')

    expect(screen.getByLabelText('Pause')).toBeTruthy()
    expect(screen.queryByLabelText('Play')).toBeNull()
  })

  it('offers play while the room is not', () => {
    renderTransport('paused')

    expect(screen.getByLabelText('Play')).toBeTruthy()
    expect(screen.queryByLabelText('Pause')).toBeNull()

    cleanup()
    renderTransport('stopped')

    expect(screen.getByLabelText('Play')).toBeTruthy()
    expect(screen.queryByLabelText('Pause')).toBeNull()
  })

  // Playing is the state worth spotting down a list of rooms, so pause takes
  // the lit variant while the room is running.
  it('lights the pause key while the room is playing', () => {
    const { container } = renderTransport('play')
    expect(container.querySelector('[aria-label="Pause"]').className).toContain('primary')

    cleanup()
    const paused = renderTransport('paused')
    expect(paused.container.querySelector('[aria-label="Play"]').className).not.toContain('primary')
  })

  // With one key swapping between two states, stop lighting up is what keeps
  // paused and stopped apart — both offer Play.
  it('lights stop only when the room is stopped', () => {
    renderTransport('stopped')
    expect(screen.getByLabelText('Stop').getAttribute('aria-pressed')).toBe('true')

    cleanup()
    renderTransport('paused')
    expect(screen.getByLabelText('Stop').getAttribute('aria-pressed')).toBe('false')
  })

  it('sends the room to play without asking', () => {
    renderTransport('paused')
    fireEvent.click(screen.getByLabelText('Play'))

    expect(screen.queryByText('Stop the room')).toBeNull()
    expect(setRoomStatus).toHaveBeenCalledWith({ roomId: 7, status: 'play' })
  })

  it('plays a stopped room rather than leaving it stranded', () => {
    renderTransport('stopped')
    fireEvent.click(screen.getByLabelText('Play'))

    expect(setRoomStatus).toHaveBeenCalledWith({ roomId: 7, status: 'play' })
  })

  // holding the room for an announcement is reversible, so asking would make
  // it feel like a decision
  it('pauses without asking', () => {
    renderTransport('play')
    fireEvent.click(screen.getByLabelText('Pause'))

    expect(screen.queryByText('Stop the room')).toBeNull()
    expect(setRoomStatus).toHaveBeenCalledWith({ roomId: 7, status: 'paused' })
  })

  // A native confirm() is suppressed outright in an embedded or managed
  // browser — it returns false with no dialog and no error — which left this
  // key looking completely dead. The ask is the app's own Modal now, so the
  // room is not stopped on the press itself.
  it('asks before stopping, since the queue and the scores go', async () => {
    renderTransport('play')
    fireEvent.click(screen.getByLabelText('Stop'))

    // the ask resolves a promise, so the dialog lands a microtask after the press
    expect(await screen.findByText(/Stop "LOVESHACK"/)).toBeTruthy()
    expect(setRoomStatus).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Stop the room'))
    await waitFor(() => expect(setRoomStatus).toHaveBeenCalledWith({ roomId: 7, status: 'stopped' }))
  })

  it('leaves the room alone when the stop is declined', async () => {
    renderTransport('play')
    fireEvent.click(screen.getByLabelText('Stop'))
    fireEvent.click(await screen.findByText('Cancel'))

    expect(setRoomStatus).not.toHaveBeenCalled()
    expect(screen.queryByText('Stop the room')).toBeNull()
  })

  // pressing stop on a stopped room is a no-op, not a re-stop: it would
  // otherwise empty a room that is already empty, and ask before doing it
  it('ignores a press on the key the room is already on', () => {
    renderTransport('stopped')
    fireEvent.click(screen.getByLabelText('Stop'))

    expect(screen.queryByText('Stop the room')).toBeNull()
    expect(setRoomStatus).not.toHaveBeenCalled()
  })
})
