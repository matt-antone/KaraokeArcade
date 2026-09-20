import React, { useState, useRef } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { setFilterStr, resetFilterStr, setTab, toggleFilterStarred } from '../../modules/library'
import { exitBattlePick, getBattlePick } from 'store/modules/battle'
import getSearchResults from '../../selectors/getSearchResults'
import getQueueBlocker from '../../selectors/getQueueBlocker'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import Tabs from 'components/Tabs/Tabs'
import styles from './LibraryHeader.css'

/**
 * The library's whole control surface, in two rows: search, tabs — plus, while
 * a battle is being arranged, a strip above them naming who this browse is for.
 *
 * The strip is deliberately the loudest thing on the screen. Every tap in the
 * list below it means something different from what it usually means, and the
 * one way that goes wrong is somebody forgetting which mode they are in and
 * handing their opponent a song they meant to queue for themselves. It carries
 * its own way out for the same reason.
 */
const LibraryHeader = () => {
  const dispatch = useAppDispatch()
  const { filterStr, filterStarred, tab } = useAppSelector(state => state.library)
  const { artistsResult, songsResult } = useAppSelector(getSearchResults)

  // Selected down to a string rather than taking the object getBattlePick
  // returns: that object is rebuilt on every call, and a component subscribed
  // to it re-renders on every action in the app.
  const battleForName = useAppSelector(state => getBattlePick(state)?.forName ?? '')

  // Said once, here, rather than on each of three hundred dimmed rows. A
  // library that has gone quiet with no reason given reads as a broken list;
  // this is the sentence that makes it a state. Not while picking for a
  // battle — that tap never reaches the queue, so nothing is blocking it.
  const queueBlocker = useAppSelector(getQueueBlocker)

  const searchInput = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(filterStr)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value)
    dispatch(setFilterStr(event.target.value))
  }

  const clearSearch = () => {
    setValue('')
    dispatch(resetFilterStr())
  }

  return (
    <div className={styles.container}>
      {battleForName && (
        <div className={styles.battleStrip}>
          <div className={styles.battleFor}>
            <span className={clsx('silkscreen', styles.battleLegend)}>picking a song for</span>
            <span className={styles.battleName} translate='no'>{battleForName}</span>
          </div>
          <Button
            variant='default'
            className={styles.battleCancel}
            onClick={() => dispatch(exitBattlePick())}
          >
            Never mind
          </Button>
        </div>
      )}

      <div className={styles.searchRow}>
        <Icon
          icon='MAGNIFIER'
          size={24}
          className={clsx(styles.magnifier, filterStr && styles.magnifierActive)}
        />
        <input
          type='search'
          className={styles.searchInput}
          placeholder='search'
          aria-label='Search the library'
          value={value}
          onChange={handleChange}
          ref={searchInput}
        />
        {filterStr && (
          <Button
            icon='CLEAR'
            size={24}
            aria-label='Clear search'
            onClick={clearSearch}
            className={styles.btnClear}
          />
        )}
        <button
          type='button'
          aria-label='Starred only'
          aria-pressed={filterStarred}
          className={clsx(styles.btnStar, filterStarred && styles.starActive)}
          onClick={() => dispatch(toggleFilterStarred())}
        >
          ★
        </button>
      </div>

      {!battleForName && queueBlocker && (
        <div className={styles.blockedNote}>
          <Icon icon='INFO_OUTLINE' size={18} />
          <span>
            {queueBlocker}
            {' — you can still search and star.'}
          </span>
        </div>
      )}

      <div className={styles.tabRow}>
        <Tabs<'artists' | 'songs'>
          active={tab}
          onChange={id => dispatch(setTab(id))}
          tabs={[
            { id: 'songs', label: 'Songs', count: songsResult.length },
            { id: 'artists', label: 'Artists', count: artistsResult.length },
          ]}
        />
      </div>
    </div>
  )
}

export default LibraryHeader
