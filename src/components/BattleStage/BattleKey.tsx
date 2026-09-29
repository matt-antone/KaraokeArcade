import React from 'react'
import clsx from 'clsx'
import styles from './BattleKey.css'

/**
 * Every key on a battle phone, drawn to Arcade Flow v2 2d.
 *
 * A filled key is a flat face with a lighter lip above and a darker one below,
 * in one of the battle's three colours: gold is the product's own key (Next,
 * Pick someone else, Back to songs, Rematch), green is the opponent's Accept
 * and the P2 vote, red is the P1 vote. The ghost key is a ring and quieter
 * type: Decline, Cancel challenge, Back to songs.
 *
 * `vote` is 13h's pair: a size down, with 3px lips instead of 4.
 */

interface BattleKeyProps {
  variant?: 'primary' | 'ghost'
  tone?: 'gold' | 'green' | 'red'
  size?: 'cta' | 'vote'
  disabled?: boolean
  className?: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}

const BattleKey = ({
  variant = 'primary', tone = 'gold', size = 'cta', disabled, className, onClick, children,
}: BattleKeyProps) => (
  <button
    type='button'
    disabled={disabled}
    onClick={onClick}
    className={clsx(
      styles.key,
      styles[variant],
      variant === 'primary' && [styles[tone], size === 'vote' && styles.vote],
      className,
    )}
  >
    {children}
  </button>
)

export default BattleKey
