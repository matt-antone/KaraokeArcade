import React from 'react'
import clsx from 'clsx'
import styles from './AnswerKey.css'

/**
 * Six states, in the order a key passes through them:
 *
 *   open     lit, still takeable
 *   chosen   lit and ringed in yellow — the one you pressed, answering still open
 *   closed   dark — a key you did not press, and can no longer press
 *   correct  lit and ringed — the answer
 *   wrong    dark — not the answer, and not yours either
 *   missed   dark and ringed in magenta — not the answer, and yours
 *
 * `closed` and `missed` exist so a phone can always answer "which one did I
 * press?" without the guest holding it in their head: the moment you commit,
 * the other three go dark, and if you got it wrong yours keeps a ring through
 * the reveal instead of vanishing into three identical dark keys.
 */
export type AnswerKeyState = 'open' | 'chosen' | 'closed' | 'correct' | 'wrong' | 'missed'

interface AnswerKeyProps {
  /** 0-3. Fixes the colour, the letter and the position, on every surface. */
  index: number
  /** The answer itself, on both surfaces: a guest reads what they are
   *  choosing rather than looking up to find out. */
  label: string
  /** 'player' is sized for a room, 'pad' for a hand. */
  variant: 'player' | 'pad'
  state?: AnswerKeyState
  /** A word at the key's far end — "your pick", "answer". */
  tag?: string
  disabled?: boolean
  onClick?: () => void
}

/**
 * One of the four trivia answer keys, and the single place their appearance is
 * decided — the player screen and every phone render this same component, so
 * key 3 cannot come out yellow in one place and violet in the other.
 *
 * A flat keycap in its answer's colour with its letter in Silkscreen. The
 * letter is what a room shouts across a bar, and it is what ties a phone's
 * list to the TV's grid now that the two lay the four out differently. Letter
 * and colour both separate the four, and neither carries the meaning alone —
 * roughly one in twelve men cannot separate red from green.
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
