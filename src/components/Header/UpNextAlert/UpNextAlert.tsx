import React from 'react'
import { createPortal } from 'react-dom'
import Button from 'components/Button/Button'
import { BATTLE_STAGE_PLATE, battleSingerOrDefault, battleSingerStage } from 'lib/battleSingers'
import styles from './UpNextAlert.css'

interface UpNextAlertProps {
  title?: string
  artist?: string
  /** Seconds until the singer is on. */
  wait: number
  /** The account's fighter; their location is the backdrop. */
  avatarId?: string | null
  /** Acknowledge the alert (the caller takes them to the queue). */
  onReady: () => void
  /** Step out of the rotation instead (and on to 07c, the queue paused). */
  onPause: () => void
}

const formatClock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

/**
 * "You're up next": the full-screen heads-up a singer gets when their turn is
 * under a minute out. Drawn over everything, so it is portalled out of the
 * header's stacking context (z-index 1) and above the nav.
 */
const UpNextAlert = ({ title, artist, wait, avatarId, onReady, onPause }: UpNextAlertProps) => createPortal(
  <div className={styles.container} role='alertdialog' aria-label="You're up next">
    <img
      className={styles.backdrop}
      src={battleSingerStage(battleSingerOrDefault(avatarId))}
      alt=''
      onError={(e) => {
        // a fighter with no location of its own stands on the dive bar
        if (!e.currentTarget.src.endsWith(BATTLE_STAGE_PLATE)) e.currentTarget.src = BATTLE_STAGE_PLATE
      }}
    />
    <div className={styles.scrim} />
    <div className={styles.card}>
      <span className={styles.kicker}>Heads up</span>
      <span className={styles.headline}>
        YOU&apos;RE
        <br />
        UP NEXT
      </span>
      <div className={styles.song}>
        <span className={styles.title}>{title}</span>
        {artist && <span className={styles.artist}>{artist}</span>}
      </div>
      <div className={styles.clock}>
        <span className={styles.clockLabel}>Head to the stage</span>
        <span className={styles.time}>{formatClock(wait)}</span>
      </div>
      <Button variant='primary' cta onClick={onReady}>I&apos;m ready</Button>
      <Button variant='default' cta onClick={onPause}>Not yet · pause my songs</Button>
    </div>
  </div>,
  document.body,
)

export default UpNextAlert
