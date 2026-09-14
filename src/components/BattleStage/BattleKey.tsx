import React from 'react'
import clsx from 'clsx'
import styles from './BattleKey.css'

/**
 * Every key on both negotiating phones.
 *
 * Three shapes and no others: the 54px filled key that commits to something,
 * the 44px ringed key that backs out of it, and the underlined micro-label for
 * the things that are edits rather than decisions. A dozen hand-rolled buttons
 * across two screens is how a 54px CONFIRM ends up beside a 48px one, and on a
 * phone in a dark bar that difference is the whole design.
 *
 * A filled key is lit in the local player's colour by default, which is what
 * makes the challenger's flow gold and the opponent's green without either
 * screen naming a colour. The two exceptions are deliberate and say something:
 * `one` is the challenger's red, worn by the key that throws the challenge,
 * and `gold` is the product's own, worn by the handoff into song picking on a
 * phone whose colour is otherwise green.
 */

interface BattleKeyProps {
  variant?: 'primary' | 'ghost' | 'link'
  tone?: 'mine' | 'one' | 'gold'
  disabled?: boolean
  className?: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}

const BattleKey = ({
  variant = 'primary', tone = 'mine', disabled, className, onClick, children,
}: BattleKeyProps) => (
  <button
    type='button'
    disabled={disabled}
    onClick={onClick}
    className={clsx(
      styles.key,
      styles[variant],
      variant === 'primary' && styles[tone],
      className,
    )}
  >
    {children}
  </button>
)

export default BattleKey
