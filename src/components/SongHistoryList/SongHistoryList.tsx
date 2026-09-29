import React from 'react'
import clsx from 'clsx'
import ButtonStar from 'components/ButtonStar/ButtonStar'
import styles from './SongHistoryList.css'

export interface SongHistoryDisplayItem {
  songId: number
  title: string
  artist: string
  /** Pre-formatted and short, e.g. "Aug 29". */
  date: string
  isStarred: boolean
  starCount: number
}

interface SongHistoryListProps {
  items: SongHistoryDisplayItem[]
  /** Starring a sung song favourites it for a future party. It cannot be re-queued tonight. */
  onStar?: (item: SongHistoryDisplayItem) => void
  /** The design draws no star here; a caller that wants one opts in. */
  showStar?: boolean
  emptyText?: string
  className?: string
}

/**
 * The singer's own past performances. Used both at the foot of the Me tab
 * and on the Account screen.
 *
 * A song sung tonight is locked for the rest of the party, so these rows
 * carry no re-queue action and no key face anywhere they appear — they are
 * a record, not a menu. The only control is the star, and only where a
 * caller asks for it.
 */
const SongHistoryList = ({ items, onStar, showStar, emptyText, className }: SongHistoryListProps) => {
  if (items.length === 0) {
    return (
      <p className={clsx('silkscreen', styles.empty, className)}>
        {emptyText || 'Songs you take a turn on show up here.'}
      </p>
    )
  }

  return (
    <ul className={clsx(styles.list, className)}>
      {items.map(item => (
        <li key={item.songId} className={styles.item}>
          <div className={styles.primary}>
            <div className={styles.title}>{item.title}</div>
            <div className={styles.artist}>{item.artist}</div>
          </div>
          <div className={styles.date}>{item.date}</div>
          {showStar && (
            <ButtonStar
              className={styles.star}
              isStarred={item.isStarred}
              onClick={() => onStar?.(item)}
            />
          )}
        </li>
      ))}
    </ul>
  )
}

export default SongHistoryList
