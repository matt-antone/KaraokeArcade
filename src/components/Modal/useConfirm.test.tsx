// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import useConfirm from './useConfirm'

/**
 * The thing window.confirm could not be trusted to do.
 *
 * The bug this replaces was silent in both directions: no dialog appeared, and
 * the caller was told "no" — so what matters here is that the promise resolves
 * exactly once, with the right answer, on every way out of the dialog. A
 * dismissal that never resolved would leave the awaiting handler suspended for
 * the life of the page, which looks identical to the bug it replaced.
 */

const OPTS = { title: 'Stop room', message: 'Line one.\n\nLine two.', confirmLabel: 'Do it' }

const Harness = ({ onAnswer }: { onAnswer: (v: boolean) => void }) => {
  const [confirm, dialog] = useConfirm()

  return (
    <>
      <button type='button' onClick={async () => onAnswer(await confirm(OPTS))}>ask</button>
      {dialog}
    </>
  )
}

const renderHarness = () => {
  const answers: boolean[] = []
  render(<Harness onAnswer={v => answers.push(v)} />)
  return answers
}

afterEach(cleanup)

describe('useConfirm', () => {
  it('draws nothing until something asks', () => {
    renderHarness()

    expect(document.querySelector('dialog')).toBeNull()
  })

  it('resolves true when the affirmative key is pressed', async () => {
    const answers = renderHarness()
    fireEvent.click(screen.getByText('ask'))

    fireEvent.click(await screen.findByText('Do it'))
    await screen.findByText('ask')

    expect(answers).toEqual([true])
    expect(screen.queryByText('Do it')).toBeNull()
  })

  it('resolves false on cancel', async () => {
    const answers = renderHarness()
    fireEvent.click(screen.getByText('ask'))

    fireEvent.click(await screen.findByText('Cancel'))
    await screen.findByText('ask')

    expect(answers).toEqual([false])
  })

  // the close key, the backdrop and Escape all route through onClose, and a
  // dismissal that answered nothing would hang the caller forever
  it('resolves false when the dialog is dismissed', async () => {
    const answers = renderHarness()
    fireEvent.click(screen.getByText('ask'))

    fireEvent.click(await screen.findByLabelText('Close'))
    await screen.findByText('ask')

    expect(answers).toEqual([false])
  })

  it('sets a blank line as a paragraph break', async () => {
    renderHarness()
    fireEvent.click(screen.getByText('ask'))

    expect(await screen.findByText('Line one.')).toBeTruthy()
    expect(screen.getByText('Line two.')).toBeTruthy()
  })
})
