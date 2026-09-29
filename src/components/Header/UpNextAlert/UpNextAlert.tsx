import React from 'react'
import { createPortal } from 'react-dom'
import Button from 'components/Button/Button'
import { battleSingerOrDefault, battleSingerStage } from 'lib/battleSingers'
import styles from './UpNextAlert.css'

interface UpNextAlertProps {
  title?: string
  artist?: string
  /** Seconds until the singer is on. */
  wait: number
  /** The account's fighter; their location is the backdrop. */
  avatarId?: string | null
  /** Acknowledge the alert and carry on. */
  onReady: () => void
  /** Step out of the rotation instead. */
  onPause: () => void
}

const formatClock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

/**
 * "You're up next": the full-screen heads-up a singer gets when their turn is
 * under a minute out. Drawn over everything, so it is portalled out of the
 * header — whose transform would otherwise become its containing block.
 */
const UpNextAlert = ({ title, artist, wait, avatarId, onReady, onPause }: UpNextAlertProps) => createPortal(
  <div className={styles.container} role='alertdialog' aria-label="You're up next">
    <img
      className={styles.backdrop}
      src={battleSingerStage(battleSingerOrDefault(avatarId))}
      alt=''
    />
    <div className={styles.card}>
      <span className={styles.kicker}>Heads up</span>
      <span className={styles.headline}>
        You&apos;re
        <br />
        up next
      </span>
      <div className={styles.song}>
        <span className={styles.title}>{title}</span>
        {artist && <span className={styles.artist}>{artist}</span>}
      </div>
      <div className={styles.clock}>
        <span className={styles.clockLabel}>Head to the stage</span>
        <span className={styles.time}>{formatClock(wait)}</span>
      </div>
      <Button variant='primary' onClick={onReady}>I&apos;m ready</Button>
      <Button variant='default' onClick={onPause}>Not yet · pause my songs</Button>
    </div>
  </div>,
  document.body,
)

export default UpNextAlert
