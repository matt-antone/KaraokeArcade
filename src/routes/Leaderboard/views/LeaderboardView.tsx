import React from 'react'
import clsx from 'clsx'
import { useAppSelector } from 'store/hooks'
import { myStanding } from 'store/selectors/points'
import { ordinal } from 'lib/ordinal'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import styles from './LeaderboardView.css'

/**
 * 08b: where everyone in the room stands tonight — singing, battles and
 * trivia, one total each. The board is the server's (see server/Points),
 * pushed on every change and on joining, so this only draws it. The title and
 * the You strip stay put; only the board scrolls.
 */
const LeaderboardView = () => {
  const leaderboard = useAppSelector(state => state.points.leaderboard)
  const userId = useAppSelector(state => state.user.userId)
  const { points, rank } = useAppSelector(myStanding)

  return (
    <div className={styles.container}>
      <div className={styles.head}>
        <h1 className={styles.title}>Tonight</h1>
        <span className={styles.count}>{`${leaderboard.length} ${leaderboard.length === 1 ? 'singer' : 'singers'}`}</span>
      </div>

      <div className={styles.you}>
        <span className={styles.youLabel}>You</span>
        <span className={styles.youRank}>{rank === null ? '-' : ordinal(rank)}</span>
        <span className={styles.youPoints}>{points}</span>
      </div>

      {leaderboard.length === 0
        ? <p className={styles.empty}>No points yet tonight. Sing, battle or play trivia to get on the board.</p>
        : (
            <ol className={styles.list}>
              {/* the row number is the place on the board, ties included,
                  as the design counts it (and the You strip) */}
              {leaderboard.map((entry, i) => (
                <li key={entry.userId} className={clsx(entry.userId === userId && styles.me)}>
                  <span className={clsx(styles.place, i < 3 && styles.top)}>{i + 1}</span>
                  <UserAvatar className={styles.avatar} avatarId={entry.avatarId} />
                  <span className={styles.name} translate='no'>{entry.name}</span>
                  <span className={styles.points}>{entry.points}</span>
                </li>
              ))}
            </ol>
          )}
    </div>
  )
}

export default LeaderboardView
