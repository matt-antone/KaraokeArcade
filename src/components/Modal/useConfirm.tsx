import React, { useCallback, useState } from 'react'
import Button from 'components/Button/Button'
import Modal from './Modal'
import styles from './useConfirm.css'

/**
 * Ask a yes/no question and wait for the answer, in the app's own Modal.
 *
 * This exists because window.confirm cannot be relied on to appear. An
 * embedded or managed browser — and any browser where somebody has ticked
 * "prevent this page from creating additional dialogs" — suppresses it and
 * returns false, with no dialog, no error and nothing in the console. Every
 * caller here reads that false as "the user said no", so the control does
 * nothing at all: the room transport's stop key, remove user, remove room and
 * the trivia reset were all silently dead in exactly that case, which is the
 * worst possible failure for the handful of keys that end things.
 *
 * A promise rather than a callback or a pair of props, so a call site keeps
 * the shape it already had — `if (!confirm(msg)) return` becomes
 * `if (!await ask(msg)) return` — and a handler that goes on to do more work
 * after the answer stays one function instead of splitting in two.
 *
 * Returns the asking function and the dialog to render. The dialog is null
 * until something asks, so putting it in a component's tree costs nothing.
 */

interface ConfirmOptions {
  /** The dialog's heading. Short — it is set in silkscreen. */
  title: string
  /** The question. Blank lines split it into paragraphs, the way these
   *  messages were already written for window.confirm. */
  message: string
  /** The affirmative key. Name the action rather than saying OK: this is the
   *  last thing between somebody and an undoable one. */
  confirmLabel: string
}

type Pending = ConfirmOptions & { resolve: (isConfirmed: boolean) => void }

export default function useConfirm (): [(opts: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null)

  const ask = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setPending({ ...opts, resolve })
  }), [])

  // Every way out answers, including the close key, the backdrop and Escape.
  // A dismissed dialog that never resolved would leave the awaiting handler
  // suspended for the life of the page.
  const answer = (isConfirmed: boolean) => {
    pending?.resolve(isConfirmed)
    setPending(null)
  }

  const dialog = pending
    ? (
        <Modal
          className={styles.modal}
          title={pending.title}
          onClose={() => answer(false)}
          buttons={(
            <>
              <Button variant='default' onClick={() => answer(false)}>Cancel</Button>
              <Button variant='danger' onClick={() => answer(true)}>{pending.confirmLabel}</Button>
            </>
          )}
        >
          {pending.message.split('\n\n').map(para => <p key={para}>{para}</p>)}
        </Modal>
      )
    : null

  return [ask, dialog]
}
