import React from 'react'
import clsx from 'clsx'
import styles from './Hud.css'

interface HudProps {
  /** Left slot. 1UP in magenta unless the screen names itself ('Trivia',
   *  'Battle'); a caller colours its own slot with a className. */
  left?: React.ReactNode
  /** The room this phone is in. */
  room?: string
  /** Right slot: whatever the screen wants read at the corner. */
  right?: React.ReactNode
  /** Connection lost dims the 1UP to disabled. */
  isDim?: boolean
  className?: string
}

/**
 * The arcade HUD row: 1UP (or the mode), the venue, and one slot for a
 * status. There is no credit counter — the slot is free for whatever the
 * screen has to say. Shared: onboarding, shell, trivia and battle draw it.
 */
const Hud = ({ left = '1UP', room, right, isDim, className }: HudProps) => (
  <div className={clsx(styles.container, right != null && styles.split, className)}>
    <span className={clsx(styles.player, isDim && styles.dim)}>{left}</span>
    <span className={styles.room} translate='no'>{room}</span>
    <span className={styles.right}>{right}</span>
  </div>
)

export default Hud
