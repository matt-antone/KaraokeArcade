import React from 'react'
import clsx from 'clsx'
import styles from './Logo.css'

interface LogoProps {
  /** Show the knob mark beside the wordmark. */
  withMark?: boolean
  /** Mark diameter in px. Below 28 it stops being legible. */
  markSize?: number
  className?: string
}

/**
 * Wordmark: KARAOKE in ink over ARCADE in amber, stacked, Michroma, tracked
 * .13em — two channel labels silkscreened on a faceplate. Never on a light
 * background, never on one line, never re-tracked.
 *
 * Both marks are CSS geometry. There is no logo image and none should be drawn.
 */
const Logo = ({ withMark, markSize = 36, className }: LogoProps) => (
  <div className={clsx(styles.container, className)} role='img' aria-label='KaraokeArcade'>
    {withMark && (
      <div
        className={styles.mark}
        aria-hidden='true'
        style={{ '--mark-size': `${markSize}px` } as React.CSSProperties}
      >
        <div className={styles.markCap} />
        <div className={styles.markIndex} />
      </div>
    )}
    <span className={styles.title} aria-hidden='true'>
      Karaoke
      <span className={styles.subtitle}>Arcade</span>
    </span>
  </div>
)

export default Logo
