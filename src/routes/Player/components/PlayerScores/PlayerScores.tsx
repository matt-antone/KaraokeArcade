import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import type { LeaderboardEntry } from 'shared/types'
import styles from './PlayerScores.css'

/** Cards per row, and the rows the viewport holds without scrolling. */
const COLS = 5
const ROWS_SHOWN = 3

/** The board's loop, off the design's runBoard: hold, then one row per step;
 *  past the end, hold, snap back to the top and pick up again. */
const FIRST_HOLD_MS = 2500
const STEP_MS = 1800
const END_HOLD_MS = 700
const RESUME_MS = 1100

/**
 * Which row the board is scrolled to, and whether that move is a snap (no
 * transition). Scrolls only a board taller than the viewport, over `steps`
 * rows: the list and its spacer row, so the last step lands on the repeat.
 */
const useBoardRow = (steps: number) => {
  const [pos, setPos] = useState({ row: 0, isSnap: true })
  const [prevSteps, setPrevSteps] = useState(steps)

  // a new length restarts the loop, snapped to the top: never a backwards scroll
  if (steps !== prevSteps) {
    setPrevSteps(steps)
    setPos({ row: 0, isSnap: true })
  }

  useEffect(() => {
    if (!steps) return

    let timerID: ReturnType<typeof setTimeout>

    const step = (row: number, wait: number) => {
      timerID = setTimeout(() => {
        setPos({ row, isSnap: false })

        if (row < steps) {
          step(row + 1, STEP_MS)
          return
        }

        timerID = setTimeout(() => {
          setPos({ row: 0, isSnap: true })
          step(1, RESUME_MS)
        }, END_HOLD_MS)
      }, wait)
    }

    step(1, FIRST_HOLD_MS)

    return () => clearTimeout(timerID)
  }, [steps])

  return pos
}

interface PlayerScoresProps {
  leaderboard: LeaderboardEntry[]
  venue?: string
}

/**
 * 14 · Tonight's scores on the TV: every singer of the night as a grid of
 * cards, best first, in the server's order. A board taller than the screen
 * scrolls as a seamless loop — the list, a blank row, then the list again, so
 * the snap back to the top lands on the same picture.
 */
const PlayerScores = ({ leaderboard, venue }: PlayerScoresProps) => {
  const rows = Math.ceil(leaderboard.length / COLS)
  const isLooping = rows > ROWS_SHOWN
  const pos = useBoardRow(isLooping ? rows + 1 : 0)
  // a board that has shrunk to fit stands still at the top
  const row = isLooping ? pos.row : 0
  // pad the last row out, then one blank row, so the repeat starts a row
  const spacers = isLooping ? (COLS - leaderboard.length % COLS) % COLS + COLS : 0

  const card = (entry: LeaderboardEntry, i: number, copy: string) => (
    <li key={`${copy}${entry.userId}`} className={styles.card} aria-hidden={copy ? true : undefined}>
      <span className={clsx(styles.rank, i < 3 && styles.podium)}>{i + 1}</span>
      <UserAvatar avatarId={entry.avatarId} size={80} className={styles.avatar} />
      <span className={styles.name} translate='no'>{entry.name}</span>
      <span className={styles.points}>{entry.points}</span>
    </li>
  )

  return (
    <div className={styles.container}>
      <div className={styles.scanlines} />
      <div className={styles.header}>
        <img className={styles.logo} src='assets/arcade/logo.svg' alt='KaraokeArcade' />
        {venue && <span className={styles.venue} translate='no'>{venue}</span>}
      </div>
      <div className={styles.titleRow}>
        <span className={styles.title}>Tonight</span>
        <span className={styles.count}>{`${leaderboard.length} singers`}</span>
      </div>
      <div className={styles.viewport}>
        <ol
          className={clsx(styles.grid, pos.isSnap && styles.snap)}
          style={{ '--row': row } as React.CSSProperties}
        >
          {leaderboard.map((entry, i) => card(entry, i, ''))}
          {isLooping && Array.from({ length: spacers }, (_, k) => <li key={`spacer${k}`} className={styles.spacer} aria-hidden />)}
          {isLooping && leaderboard.map((entry, i) => card(entry, i, 'again'))}
        </ol>
      </div>
    </div>
  )
}

export default PlayerScores
