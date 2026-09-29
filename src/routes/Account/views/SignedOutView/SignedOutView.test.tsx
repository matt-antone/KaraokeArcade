// @vitest-environment happy-dom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Provider } from 'react-redux'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import SignedOutView from './SignedOutView'

/**
 * 02 Join as keeps one name well across Returning user, New user and Guest
 * (only the password well toggles), and draws no focused field on arrival.
 */

vi.mock('store/modules/rooms', () => ({ fetchRooms: () => ({ type: 'test/rooms' }) }))
vi.mock('store/modules/user', () => ({
  createAccount: () => ({ type: 'test/create' }),
  login: () => ({ type: 'test/login' }),
}))

beforeEach(() => sessionStorage.setItem('tokenInserted', '1'))
afterEach(cleanup)

const state = {
  prefs: { roles: { result: [2, 3], entities: { 2: { name: 'standard' }, 3: { name: 'guest' } } } },
  rooms: {
    result: [1],
    entities: { 1: { name: 'The Dive', prefs: { roles: { 2: { allowNew: true }, 3: { allowNew: true } } } } },
  },
}

const store = {
  getState: () => state,
  subscribe: () => () => {},
  dispatch: (action: unknown) => action,
} as never

const nameWell = () => screen.getByPlaceholderText('name') as HTMLInputElement

describe('SignedOutView', () => {
  it('keeps the typed name when switching between the ways in', () => {
    render(<Provider store={store}><SignedOutView /></Provider>)

    expect(document.activeElement).toBe(document.body)

    fireEvent.change(nameWell(), { target: { value: 'belter' } })
    fireEvent.click(screen.getByText('New user'))
    expect(nameWell().value).toBe('belter')

    fireEvent.change(nameWell(), { target: { value: 'belter2' } })
    fireEvent.click(screen.getByText('Guest'))
    expect(nameWell().value).toBe('belter2')
    expect(screen.queryByPlaceholderText('password')).toBeNull()

    fireEvent.click(screen.getByText('Returning user'))
    expect(nameWell().value).toBe('belter2')
    expect(screen.getByPlaceholderText('password')).toBeTruthy()
  })
})
