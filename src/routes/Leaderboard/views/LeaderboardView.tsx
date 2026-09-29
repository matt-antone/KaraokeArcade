import React from 'react'
import { useAppSelector } from 'store/hooks'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import styles from './LeaderboardView.css'

/**
 * Where everyone in the room stands tonight: singing, battles and trivia, one
 * total each. The board is the server's (see server/Points), pushed on every
 * change and on joining, so this only draws it.
 */
const LeaderboardView = () => {
  const leaderboard = useAppSelector(state => state.points.leaderboard)
  const userId = useAppSelector(state => state.user.userId)

  const myIndex = leaderboard.findIndex(entry => entry.userId === userId)

  return (
    <div className={styles.container}>
      <div className={styles.head}>
        <h1 className={styles.title}>Tonight</h1>
        <span className={styles.count}>{`${leaderboard.length} ${leaderboard.length === 1 ? 'singer' : 'singers'}`}</span>
      </div>

      {myIndex >= 0 && (
        <div className={styles.you}>
          <span className={styles.youLabel}>You</span>
          <span className={styles.youRank}>{`#${myIndex + 1}`}</span>
          <span className={styles.youPoints}>{leaderboard[myIndex].points.toLocaleString()}</span>
        </div>
      )}

      {leaderboard.length === 0
        ? <p className={styles.empty}>No points yet tonight. Sing, battle or play trivia to get on the board.</p>
        : (
            <ol className={styles.list}>
              {leaderboard.map((entry, i) => (
                <li key={entry.userId} className={entry.userId === userId ? styles.me : undefined}>
                  <span className={styles.place}>{i + 1}</span>
                  <UserAvatar className={styles.avatar} avatarId={entry.avatarId} />
                  <span className={styles.name} translate='no'>{entry.name}</span>
                  <span className={styles.points}>{entry.points.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
    </div>
  )
}

export default LeaderboardView
