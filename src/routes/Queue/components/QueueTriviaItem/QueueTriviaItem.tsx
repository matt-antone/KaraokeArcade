import { gameLabel } from 'shared/party'
import React from 'react'
import clsx from 'clsx'
import TriviaMark from 'components/TriviaMark/TriviaMark'
import styles from './QueueTriviaItem.css'

interface QueueTriviaItemProps {
  type?: string
  isPlayed: boolean
  /** 1-based place in the turns still to come. Absent on played rows. */
  position?: number
}

/**
 * A trivia round's place in the queue.
 *
 * Deliberately not a QueueItem in a different costume: it has no singer, no
 * song, no star, no key and no swipe actions, so almost everything that row
 * does would have to be switched off. What the two do share is the 07 row's
 * frame — place, 52px well, text — so the rotation still reads as one list.
 *
 * The row is the server's to manage — it appears when trivia is on and is
 * replaced after each round — so there is nothing here to act on. It answers
 * one question: when is the next round.
 */
const QueueTriviaItem = ({ isPlayed, position, type }: QueueTriviaItemProps) => (
  <div className={styles.shell}>
    <div className={clsx(styles.container, isPlayed && styles.spent)}>
      {position !== undefined && <div className={styles.position}>{position}</div>}

      <div className={styles.iconWell}>
        <TriviaMark variant='glyph' isDim={isPlayed} className={styles.mark} />
      </div>

      <div className={styles.primary}>
        <div className={styles.title}>{gameLabel(type)}</div>
        <div className={clsx('silkscreen', styles.subtitle)}>
          {isPlayed ? 'Round played' : 'Music round'}
        </div>
      </div>

    </div>
  </div>
)

export default QueueTriviaItem
