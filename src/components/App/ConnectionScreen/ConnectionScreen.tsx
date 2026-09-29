import React from 'react'
import clsx from 'clsx'
import Button from 'components/Button/Button'
import Hud from 'components/Header/Hud/Hud'
import Logo from 'components/Logo/Logo'
import Spinner from 'components/Spinner/Spinner'
import styles from './ConnectionScreen.css'

interface ConnectionScreenProps {
  /** 90 Connection lost, or 91 Loading before the socket has answered once. */
  variant: 'lost' | 'loading'
  room?: string
  /** Which reconnect attempt is under way. */
  attempt?: number
  onRetry?: () => void
}

/**
 * The two screens drawn over the app while the socket is not up. Lost dims the
 * HUD's 1UP and offers a manual retry; loading is the logo over the spinner.
 */
const ConnectionScreen = ({ variant, room, attempt = 0, onRetry }: ConnectionScreenProps) => (
  variant === 'loading'
    ? (
        <div className={styles.container}>
          <div className={styles.body}>
            <Logo withMark markSize={72} />
            <Spinner />
            <span className={styles.tip}>Tip: a battle win is worth 1000 pts</span>
          </div>
        </div>
      )
    : (
        <div className={clsx(styles.container, styles.lost)}>
          <Hud room={room} isDim right={<span className={styles.offline}>Offline</span>} />
          <div className={styles.body}>
            <span className={styles.headline}>
              Connection
              <br />
              lost
            </span>
            <span className={styles.status}>
              Reconnecting
              {attempt > 0 && ` · try ${attempt}`}
            </span>
          </div>
          <div className={styles.actions}>
            <Button variant='primary' onClick={onRetry}>Retry now</Button>
          </div>
        </div>
      )
)

export default ConnectionScreen
