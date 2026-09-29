// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Provider } from 'react-redux'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ResetPassword from './ResetPassword'

/**
 * 02b is one screen: a name carried over from sign-in fetches its question on
 * arrival, the new password is typed once and sent as its own confirm, and a
 * reset that goes through hands the name and password on to sign in.
 */

// plain actions standing in for the thunks, so what they were asked can be read
vi.mock('store/modules/user', () => ({
  fetchResetQuestion: (username: string) => ({ type: 'test/question', username }),
  resetPassword: (body: unknown) => ({ type: 'test/reset', body }),
}))

afterEach(cleanup)

const makeStore = () => {
  const dispatched: { type: string, username?: string, body?: Record<string, string> }[] = []

  return {
    dispatched,
    store: {
      getState: () => ({}),
      subscribe: () => () => {},
      dispatch: (action: { type: string }) => {
        dispatched.push(action)
        return { unwrap: () => Promise.resolve(action.type === 'test/question' ? 'What was your first concert?' : undefined) }
      },
    } as never,
  }
}

describe('ResetPassword', () => {
  it('asks the carried-over name its question, then resets and signs in', async () => {
    const { store, dispatched } = makeStore()
    const onReset = vi.fn()
    render(
      <Provider store={store}>
        <ResetPassword initialUsername='jumpinjammer' onReset={onReset} onBack={vi.fn()} />
      </Provider>,
    )

    expect(await screen.findByText('What was your first concert?')).toBeTruthy()
    expect(dispatched[0]).toEqual({ type: 'test/question', username: 'jumpinjammer' })

    fireEvent.change(screen.getByPlaceholderText('answer'), { target: { value: 'Blondie' } })
    fireEvent.change(screen.getByPlaceholderText('new password'), { target: { value: 'hunter22' } })
    fireEvent.click(screen.getByText('Reset & sign in'))

    await waitFor(() => expect(onReset).toHaveBeenCalledWith('jumpinjammer', 'hunter22'))
    expect(dispatched[1].body).toEqual({
      username: 'jumpinjammer',
      securityAnswer: 'Blondie',
      newPassword: 'hunter22',
      newPasswordConfirm: 'hunter22',
    })
  })

  it('asks for a name first when sign-in had none', () => {
    const { store, dispatched } = makeStore()
    render(
      <Provider store={store}>
        <ResetPassword initialUsername='' onReset={vi.fn()} onBack={vi.fn()} />
      </Provider>,
    )

    expect(screen.getByText('Next')).toBeTruthy()
    expect(dispatched).toHaveLength(0)
  })
})
