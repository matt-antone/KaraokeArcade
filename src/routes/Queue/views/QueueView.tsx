import React, { useEffect } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { ensureState } from 'redux-optimistic-ui'
import { useNavigate } from 'react-router'
import { toggleSongStarred } from 'store/modules/userStars'
import { setQueueTab } from 'store/modules/ui'
import { resetFilterStr, setTab, toggleFilterStarred } from 'routes/Library/modules/library'
import getQueueDisplay from '../selectors/getQueueDisplay'
import getQueueSections from '../selectors/getQueueSections'
import QueueList from '../components/QueueList/QueueList'
import Button from 'components/Button/Button'
import Panel from 'components/Panel/Panel'
import SongHistoryList, { type SongHistoryDisplayItem } from 'components/SongHistoryList/SongHistoryList'
import Spinner from 'components/Spinner/Spinner'
import TextOverlay from 'components/TextOverlay/TextOverlay'
import { formatShortDate } from 'lib/dateTime'
import styles from './QueueView.css'

/** 07b: one sentence and one amber key, no headline. Every empty tab here
 *  speaks the same way. */
const Empty = ({ children, cta, onClick }: { children: React.ReactNode, cta: string, onClick: () => void }) => (
  <TextOverlay className={styles.empty}>
    <p>{children}</p>
    <div className={styles.cta}>
      <Button variant='primary' cta onClick={onClick}>{cta}</Button>
    </div>
  </TextOverlay>
)

const QueueView = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { innerWidth, innerHeight, headerHeight, footerHeight } = useAppSelector(state => state.ui)
  const isInRoom = useAppSelector(state => !!state.user.roomId)
  const isLoading = useAppSelector(state => ensureState(state.queue).isLoading)
  const queueTab = useAppSelector(state => state.ui.queueTab)
  const isStarredOnly = useAppSelector(state => state.library.filterStarred)
  const isPaused = useAppSelector(state => ensureState(state.queue).pausedUserIds.includes(state.user.userId))
  const { played } = useAppSelector(getQueueSections)
  const { upcoming, mine } = useAppSelector(getQueueDisplay)
  const history = useAppSelector(state => state.user.history)
  const starredSongs = useAppSelector(state => ensureState(state.userStars).starredSongs)
  const starCounts = useAppSelector(state => state.starCounts)

  const historyItems: SongHistoryDisplayItem[] = history.map(({ songId, artist, title, dateSung }) => ({
    songId,
    artist,
    title,
    date: formatShortDate(new Date(dateSung * 1000)),
    isStarred: starredSongs.includes(songId),
    starCount: starCounts.songs[songId] || 0,
  }))

  // 07, 07b and 07c always draw the Queue tab: leaving puts it back, so every
  // way in (nav, II, the up-next alert) lands there
  useEffect(() => () => {
    dispatch(setQueueTab('queue'))
  }, [dispatch])

  // II pressed while already here (Me, History) still lands on 07c
  useEffect(() => {
    if (isPaused) dispatch(setQueueTab('queue'))
  }, [dispatch, isPaused])

  // 07b's key goes to 04: the Songs tab, unfiltered
  const toSongs = () => {
    dispatch(setTab('songs'))
    dispatch(resetFilterStr())
    if (isStarredOnly) dispatch(toggleFilterStarred())
    navigate('/library')
  }

  // what an empty tab says, if this one is empty
  let empty: React.ReactNode = null

  if (!isInRoom) {
    empty = <Empty cta='Sign in' onClick={() => navigate('/account')}>Sign in to a room to start queueing songs.</Empty>
  } else if (isLoading) {
    empty = <Spinner />
  } else if (queueTab === 'queue' && upcoming.length === 0) {
    empty = <Empty cta='Browse songs' onClick={toSongs}>Nobody’s queued yet. Pick a song and you’re first up.</Empty>
  } else if (queueTab === 'me' && mine.length === 0) {
    empty = <Empty cta='Browse songs' onClick={toSongs}>Nothing queued yet. Tap a song in the library to queue it.</Empty>
  } else if (queueTab === 'history' && played.length === 0) {
    empty = <Empty cta='Browse songs' onClick={toSongs}>Nothing sung yet. Songs land here once they’ve been played.</Empty>
  }

  return (
    <div
      className={styles.container}
      style={{
        paddingTop: headerHeight,
        paddingBottom: footerHeight,
        width: innerWidth,
        height: innerHeight,
      }}
    >
      {empty ?? (
        <div className={styles.list}>
          {queueTab === 'me' && (
            <div className={clsx('silkscreen', styles.caption)}>My songs &mdash; hold to reorder, swipe for settings</div>
          )}
          {queueTab === 'history' && (
            <div className={clsx('silkscreen', styles.caption)}>Sung tonight &mdash; these are locked</div>
          )}

          <QueueList />
        </div>
      )}

      {isInRoom && !isLoading && queueTab === 'me' && (
        <div className={styles.meFooter}>
          {/* a labelled key needs a variant: without one it renders bare, and
              the label inherits the view's dim ink onto the dark ground */}
          <Button variant='default' icon='PLUS' size={20} onClick={toSongs}>
            Queue another song
          </Button>

          <Panel title='Sung Tonight' contentClassName={styles.historyContent}>
            <SongHistoryList
              items={historyItems}
              onStar={item => dispatch(toggleSongStarred(item.songId))}
            />
          </Panel>
        </div>
      )}
    </div>
  )
}

export default QueueView
