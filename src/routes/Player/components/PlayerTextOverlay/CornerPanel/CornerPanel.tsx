import React from 'react'
import clsx from 'clsx'
import styles from './CornerPanel.css'

interface CornerPanelProps {
  /** Printed before the name: 'on stage' or 'up next'. */
  label: string
  singer: string
  /** Amber for whoever is on stage now, mint for whoever is next. */
  tone?: 'ink' | 'vu'
  songTitle?: string
  songArtist?: string
}

// 11b · the bar across the top of a playing song, keeping the rest of the
// frame clear for lyrics. It always names the singer *and* their song — a name
// alone leaves the room guessing what is about to play.
const CornerPanel = ({ label, singer, tone = 'ink', songTitle, songArtist }: CornerPanelProps) => (
  <div className={styles.panel}>
    <img className={styles.logo} src='assets/arcade/logo.svg' alt='' />
    <span className={styles.rule} />
    <span className={styles.label}>{label}</span>
    <span className={clsx(styles.singer, tone === 'vu' && styles.vu)} translate='no'>{singer}</span>
    {songTitle && (
      <span className={styles.song} translate='no'>
        {songTitle}
        {songArtist && <span className={styles.artist}>{` · ${songArtist}`}</span>}
      </span>
    )}
  </div>
)

export default CornerPanel
