import React from 'react'
import clsx from 'clsx'
import styles from './Logo.css'

/** Served by koa-static off the assets dir, relative so it follows <base href>. */
const LOCKUP = 'assets/arcade/logo.svg'

interface LogoProps {
  /** Show the full lockup: the token-in-slot mark beside the wordmark. */
  withMark?: boolean
  /** Lockup height in px. */
  markSize?: number
  className?: string
}

/**
 * The KaraokeArcade logo. With the mark it is the approved lockup art
 * (assets/arcade/logo.svg), which is trimmed tight — give it room, never edit
 * it. Without, it is the wordmark set in Silkscreen: KARAOKE in ink, ARCADE in
 * amber.
 */
const Logo = ({ withMark, markSize = 30, className }: LogoProps) => (
  <div className={clsx(styles.container, className)} role='img' aria-label='KaraokeArcade'>
    {withMark
      ? <img className={styles.lockup} src={LOCKUP} alt='' style={{ height: markSize }} />
      : (
          <span className={styles.title} aria-hidden='true'>
            Karaoke
            <span className={styles.subtitle}>Arcade</span>
          </span>
        )}
  </div>
)

export default Logo
