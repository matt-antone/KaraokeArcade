import React from 'react'
import clsx from 'clsx'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import type { LeaderboardEntry } from 'shared/types'
import styles from './PlayerScores.css'

/** Three rows of five: what a TV shows without scrolling. */
const SHOWN = 15

interface PlayerScoresProps {
  leaderboard: LeaderboardEntry[]
  venue?: string
}

/**
 * Tonight's scores on the TV: the room's leaderboard as a grid of cards, best
 * first, each singer drawn as their own fighter. The order is the server's.
 */
const PlayerScores = ({ leaderboard, venue }: PlayerScoresProps) => (
  <div className={styles.container}>
    <div className={styles.header}>
      <img className={styles.logo} src='assets/arcade/logo.svg' alt='KaraokeArcade' />
      {venue && <span className={styles.venue} translate='no'>{venue}</span>}
    </div>
    <div className={styles.titleRow}>
      <span className={styles.title}>Tonight</span>
      <span className={styles.count}>{`${leaderboard.length} ${leaderboard.length === 1 ? 'singer' : 'singers'}`}</span>
    </div>
    <ol className={styles.grid}>
      {leaderboard.slice(0, SHOWN).map((entry, i) => (
        <li key={entry.userId} className={clsx(styles.card, i === 0 && styles.first)}>
          <span className={styles.rank}>{i + 1}</span>
          <UserAvatar avatarId={entry.avatarId} size={80} className={styles.avatar} />
          <span className={styles.name} translate='no'>{entry.name}</span>
          <span className={styles.points}>{entry.points.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  </div>
)

export default PlayerScores
