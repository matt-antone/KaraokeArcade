import React from 'react'
import clsx from 'clsx'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import styles from './QueueBattleItem.css'

/** One side of the fight, already resolved: the queue row carries ids, and
 *  looking a song up is the list's job, not this row's. */
interface BattleFighter {
  userId: number
  name: string
  /** Who they fought *as*, snapshotted onto the row at match time (017). This
   *  is what the row draws: a battle looks the same on every screen and keeps
   *  looking that way after somebody changes their character mid-night. */
  singerId: string | null
  /** Who they are on their account right now. Only reached for a battle
   *  queued before the snapshot existed -- if the row is a battle, the row
   *  decides; otherwise the account decides. */
  avatarId: string | null
  title: string
  artist: string
}

interface QueueBattleItemProps {
  isCurrent: boolean
  isPlayed: boolean
  challenger: BattleFighter
  opponent: BattleFighter
}

/**
 * A battle's place in the queue.
 *
 * Two singers and two songs, and the whole point of the row is that they are
 * ONE turn: a battle costs the challenger the slot they already had, and the
 * rotation behind it moves up by one, not two. So the two fighters sit inside a
 * single shell with a single header, rather than being two rows that happen to
 * be adjacent — which is exactly what somebody counting the queue would
 * miscount.
 *
 * Not a QueueItem in a costume, for QueueTriviaItem's reason: none of that
 * row's actions have an answer here. There is no one owner to remove it, no
 * single song to star or transpose, and dragging it would move both fighters at
 * once. What it shares with the singers around it is its shell and its edge, so
 * the rotation still reads as one list.
 *
 * The two channels are the crimson and moss the TV uses during the fight, and
 * the same two the library's picking banner wears. They appear as edges rather
 * than as coloured text: both measure under 3:1 as ink on this faceplate, and
 * this row is read across a dark bar.
 */
const QueueBattleItem = ({ isCurrent, isPlayed, challenger, opponent }: QueueBattleItemProps) => {
  const sides = [
    { ...challenger, sideClass: styles.challenger },
    { ...opponent, sideClass: styles.opponent },
  ]

  return (
    <div className={clsx(styles.shell, isCurrent && styles.current)}>
      <div className={clsx(styles.container, isPlayed && styles.spent)}>
        <div className={styles.header}>
          <span className={clsx('silkscreen', styles.legend)}>
            {isCurrent ? 'singer battle · on stage' : isPlayed ? 'singer battle · fought' : 'singer battle · one turn, two songs'}
          </span>
          {isCurrent && <span className={styles.now}>NOW</span>}
        </div>

        {sides.map(side => (
          <div key={side.userId} className={clsx(styles.fighter, side.sideClass)}>
            <UserAvatar
              className={styles.avatar}
              avatarId={side.singerId || side.avatarId}
            />

            <div className={styles.primary}>
              <div className={styles.name} translate='no'>{side.name}</div>
              {/* titles always show in full: they wrap, and the row grows */}
              <div className={styles.title} translate='no'>{side.title}</div>
              {side.artist && (
                <div className={clsx('silkscreen', styles.artist)} translate='no'>{side.artist}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default QueueBattleItem
