import React from 'react'
import clsx from 'clsx'
import styles from './AnswerKey.css'

/**
 * The states a key passes through:
 *
 *   open     lit, still takeable
 *   chosen   lit and ringed white — the one you pressed, answering still open
 *   closed   lit but dimmed — one you did not press, and can no longer press
 *   correct  the answer: ringed and glowing on the TV, ringed mint on a card
 *   wrong    dark — not the answer (the TV's reveal)
 *   right    lit and ringed yellow — yours, and the answer (a phone's card)
 *   missed   dark and ringed magenta — yours, and not the answer (a card)
 *
 * `closed` and `missed` exist so a phone can always answer "which one did I
 * press?" without the guest holding it in their head.
 */
export type AnswerKeyState = 'open' | 'chosen' | 'closed' | 'correct' | 'wrong' | 'right' | 'missed'

interface AnswerKeyProps {
  /** 0-3. Fixes the colour, the letter and the position, on every surface. */
  index: number
  /** The answer itself, on every surface: a guest reads what they are
   *  choosing rather than looking up to find out. */
  label: string
  /** 'player' is the TV's row of four (12b/12c), 'pad' a phone's key (12e),
   *  'card' a phone's result card (12f*). */
  variant: 'player' | 'pad' | 'card'
  state?: AnswerKeyState
  /** A word at the key's far end — "Your pick", "Answer". */
  tag?: string
  disabled?: boolean
  onClick?: () => void
}

/**
 * One of the four trivia answer keys, and the single place their appearance is
 * decided — the player screen and every phone render this same component, so
 * key 3 cannot come out yellow in one place and violet in the other.
 *
 * A flat keycap in its answer's colour with its letter in Silkscreen. Letter
 * and colour both separate the four, and neither carries the meaning alone.
 */
const AnswerKey = ({ index, label, variant, state = 'open', tag, disabled, onClick }: AnswerKeyProps) => (
  <button
    type='button'
    className={clsx(styles.key, styles[`k${index}`], styles[state], styles[variant])}
    disabled={disabled}
    onClick={onClick}
  >
    <span className={styles.letter} aria-hidden='true'>{'ABCD'[index]}</span>
    <span className={styles.label}>{label}</span>
    {tag && <span className={styles.tag}>{tag}</span>}
  </button>
)

export default AnswerKey
