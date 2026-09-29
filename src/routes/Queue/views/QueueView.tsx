import React, { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { ensureState } from 'redux-optimistic-ui'
import { Link, useNavigate } from 'react-router'
import { toggleSongStarred } from 'store/modules/userStars'
import getMyUpcoming from '../selectors/getMyUpcoming'
import getQueueSections from '../selectors/getQueueSections'
import getRoundRobinQueue from '../selectors/getRoundRobinQueue'
import QueueList from '../components/QueueList/QueueList'
import Button from 'components/Button/Button'
import Panel from 'components/Panel/Panel'
import SongHistoryList, { type SongHistoryDisplayItem } from 'components/SongHistoryList/SongHistoryList'
import Spinner from 'components/Spinner/Spinner'
import TextOverlay from 'components/TextOverlay/TextOverlay'
import { formatShortDate } from 'lib/dateTime'
import styles from './QueueView.css'

const QUEUE_ITEM_HEIGHT = 92

const QueueView = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { innerWidth, innerHeight, headerHeight, footerHeight } = useAppSelector(state => state.ui)
  const isInRoom = useAppSelector(state => !!state.user.roomId)
  const isLoading = useAppSelector(state => ensureState(state.queue).isLoading)
  const queue = useAppSelector(getRoundRobinQueue)
  const queueId = useAppSelector(state => state.status.queueId)
  const queueTab = useAppSelector(state => state.ui.queueTab)
  const { played, upcoming } = useAppSelector(getQueueSections)
  const mine = useAppSelector(getMyUpcoming)
  const history = useAppSelector(state => state.user.history)
  const starredSongs = useAppSelector(state => ensureState(state.userStars).starredSongs)
  const starCounts = useAppSelector(state => state.starCounts)
  const containerRef = useRef<HTMLDivElement>(null)

  const historyItems: SongHistoryDisplayItem[] = history.map(({ songId, artist, title, dateSung }) => ({
    songId,
    artist,
    title,
    date: formatShortDate(new Date(dateSung * 1000)),
    isStarred: starredSongs.includes(songId),
    starCount: starCounts.songs[songId] || 0,
  }))

  // ensure current song is in view on first mount only
  useEffect(() => {
    if (containerRef.current) {
      const i = queue.result.indexOf(queueId)
      containerRef.current.scrollTop = QUEUE_ITEM_HEIGHT * i
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={styles.container}
      ref={containerRef}
      style={{
        paddingTop: headerHeight,
        paddingBottom: footerHeight,
        width: innerWidth,
        height: innerHeight,
      }}
    >
      {!isInRoom && (
        <TextOverlay className={styles.empty}>
          <h1>Get a Room!</h1>
          <p>
            <Link to='/account'>Sign in to a room</Link>
            {' '}
            to start queueing songs.
          </p>
        </TextOverlay>
      )}

      {isLoading && <Spinner />}

      {!isLoading && queueTab === 'history' && played.length === 0 && (
        <TextOverlay className={styles.empty}>
          <h1>Nothing Sung Yet</h1>
          <p>Songs land here once they&rsquo;ve been played.</p>
        </TextOverlay>
      )}

      {!isLoading && queueTab === 'queue' && upcoming.length === 0 && (
        <TextOverlay className={styles.empty}>
          <h1>Queue Empty</h1>
          <p>Nobody&rsquo;s queued yet. Pick a song and you&rsquo;re first up.</p>
          <Button variant='primary' className={styles.browse} onClick={() => navigate('/library')}>
            Browse songs
          </Button>
        </TextOverlay>
      )}

      {!isLoading && queueTab === 'me' && mine.length === 0 && (
        <TextOverlay className={styles.empty}>
          <h1>Nothing Queued</h1>
          <p>
            Tap a song in the
            {' '}
            <Link to='/library'>library</Link>
            {' '}
            to queue it.
          </p>
        </TextOverlay>
      )}

      {!isLoading && queueTab === 'me' && mine.length > 0 && (
        <div className={clsx('silkscreen', styles.caption)}>my songs &mdash; drag to reorder, swipe for settings</div>
      )}

      {!isLoading && queueTab === 'history' && played.length > 0 && (
        <div className={clsx('silkscreen', styles.caption)}>sung tonight &mdash; these are locked</div>
      )}

      <QueueList />

      {!isLoading && queueTab === 'me' && (
        <div className={styles.meFooter}>
          {/* a labelled key needs a variant: without one it renders bare, and
              the label inherits the view's dim ink onto the dark ground */}
          <Button variant='default' icon='PLUS' size={20} onClick={() => navigate('/library')}>
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
