import React from 'react'
import { useAppSelector } from 'store/hooks'
import SongHistoryList, { type SongHistoryDisplayItem } from 'components/SongHistoryList/SongHistoryList'
import { formatShortDate } from 'lib/dateTime'
import styles from './SongHistory.css'

/** 08 Song history: a plain label over the rows, no panel and no star. */
const SongHistory = () => {
  const history = useAppSelector(state => state.user.history)

  const items: SongHistoryDisplayItem[] = history.map(({ songId, artist, title, dateSung }) => ({
    songId,
    artist,
    title,
    date: formatShortDate(new Date(dateSung * 1000)),
    isStarred: false,
    starCount: 0,
  }))

  return (
    <>
      <div className={styles.heading}>Song history</div>
      <SongHistoryList items={items} className={styles.list} />
    </>
  )
}

export default SongHistory
