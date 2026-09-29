import React from 'react'
import clsx from 'clsx'
import Button from 'components/Button/Button'
import styles from './ButtonStar.css'

interface ButtonStarProps {
  className?: string
  onClick: (e: React.MouseEvent) => void
  /** Accepted and ignored: the design prints no star count. Callers drop it. */
  count?: number
  isStarred: boolean
}

/**
 * Star a song: the design's row tag, a Silkscreen 11px text star. Off is
 * --arc-line and reads as unlit; on is yellow and reads as lit. A text star,
 * never an emoji, and no count beside it.
 */
const ButtonStar = ({ className, onClick, isStarred }: ButtonStarProps) => (
  <Button
    onClick={onClick}
    aria-label={isStarred ? 'unstar' : 'star'}
    aria-pressed={isStarred}
    className={clsx(styles.container, isStarred && styles.starred, className)}
  >
    <span className={styles.star}>★</span>
  </Button>
)

export default ButtonStar
