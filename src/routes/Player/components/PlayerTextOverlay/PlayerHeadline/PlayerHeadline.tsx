import React from 'react'
import clsx from 'clsx'
import styles from './PlayerHeadline.css'

interface PlayerHeadlineProps {
  /** Short. One to three words. Rendered uppercase. */
  children?: React.ReactNode
  /** 'ink' for names and titles, 'vu' for the thing the room should act on. */
  tone?: 'ink' | 'vu'
  /** Defaults to var(--display-l). Use var(--display-xl) for the countdown numeral. */
  size?: string
  className?: string
}

// The player's voice: Silkscreen, wide-tracked, amber or ink. Replaces the old
// rainbow per-character ColorCycle entirely — this brand shouts by being large.
const PlayerHeadline = ({ children, tone = 'ink', size, className }: PlayerHeadlineProps) => (
  <div
    className={clsx(styles.headline, tone === 'vu' && styles.vu, className)}
    translate='no'
    style={size ? { fontSize: size } : undefined}
  >
    {children}
  </div>
)

export default PlayerHeadline
