import React from 'react'
import clsx from 'clsx'
import styles from './Hud.css'

interface HudProps {
  /** The room this phone is in. */
  room?: string
  /** Right slot: whatever the screen wants read at the corner. */
  right?: React.ReactNode
  /** Connection lost dims the 1UP to disabled. */
  isDim?: boolean
  className?: string
}

/**
 * The arcade HUD row: 1UP, the venue, and one slot for a status. There is no
 * credit counter — the slot is free for whatever the screen has to say.
 */
const Hud = ({ room, right, isDim, className }: HudProps) => (
  <div className={clsx(styles.container, className)}>
    <span className={clsx(styles.player, isDim && styles.dim)}>1UP</span>
    <span className={styles.room} translate='no'>{room}</span>
    <span className={styles.right}>{right}</span>
  </div>
)

export default Hud
