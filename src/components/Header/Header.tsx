import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import type { RootState } from 'store/store'
import { Routes, Route, useLocation, useNavigate } from 'react-router'
import { createSelector } from '@reduxjs/toolkit'

import { ensureState } from 'redux-optimistic-ui'
import { formatSeconds } from 'lib/dateTime'
import { setPaused } from 'routes/Queue/modules/queue'
import getMyRotation from 'routes/Queue/selectors/getMyRotation'
import getMyUpcoming from 'routes/Queue/selectors/getMyUpcoming'
import getRoundRobinQueue from 'routes/Queue/selectors/getRoundRobinQueue'
import getWaits from 'routes/Queue/selectors/getWaits'
import LibraryHeader from 'routes/Library/components/LibraryHeader/LibraryHeader'
import QueueHeader from 'routes/Queue/components/QueueHeader/QueueHeader'
import Logo from 'components/Logo/Logo'
import { myStanding } from 'store/selectors/points'
import { showErrorMessage } from 'store/modules/ui'
import UpNextAlert from './UpNextAlert/UpNextAlert'
import YourTurn from './YourTurn/YourTurn'
import styles from './Header.css'

// selectors
const getIsAtQueueEnd = (state: RootState) => state.status.isAtQueueEnd
const getQueueId = (state: RootState) => state.status.queueId
const getUserId = (state: RootState) => state.user.userId

/** Seconds out at which the full-screen "you're up next" alert takes over. */
const UP_NEXT_ALERT_SECONDS = 60

/**
 * The singer's next song: its queue id, the wait until it in seconds, and its
 * title. One lookup — the title, the time and the meter all describe the same
 * song, and getWaits is recomputed from song durations and the live playhead,
 * so the wait ticks down every second the player reports.
 */
const getMyNext = createSelector(
  [getMyUpcoming, getWaits, (state: RootState) => ensureState(state.queue).entities, (state: RootState) => state.songs, (state: RootState) => state.artists],
  (upcoming, waits, queueItems, songs, artists): { queueId?: number, wait?: number, title?: string, artist?: string } => {
    const queueId = upcoming[0]
    const item = queueItems[queueId]

    return {
      queueId,
      wait: waits[queueId],
      title: item ? songs.entities[item.songId]?.title : undefined,
      artist: item ? artists.entities[songs.entities[item.songId]?.artistId]?.name : undefined,
    }
  },
)

/** The title on stage while it is this singer's, or undefined when it is not. */
const getMyStageSong = createSelector(
  [getRoundRobinQueue, getQueueId, getIsAtQueueEnd, getUserId, (state: RootState) => state.songs],
  (queue, queueId, isAtQueueEnd, userId, songs) => {
    const curItem = queue.entities[queueId]

    return curItem && !isAtQueueEnd && curItem.userId === userId
      ? songs.entities[curItem.songId]?.title ?? ''
      : undefined
  },
)

const BATTLES_OFF = 'Singer battles are switched off for this room.'

interface HeaderProps {
  /** Open the battle roster. Owned by CoreLayout because the key that opens it
   *  lives in here and the dialog it opens is mounted out there, beside the
   *  trivia pad. */
  onBattle?: () => void
}

/**
 * The phone's chrome, static above the route (only the route scrolls): the
 * brand row — logo left, venue right — then the HUD block. /leaderboard (08b)
 * draws the brand row alone. Nothing at all before sign-in, where onboarding
 * draws its own HUD and logo, or on the player, which is a room fixture.
 */
const Header = React.forwardRef<HTMLDivElement, HeaderProps>(({ onBattle }, ref) => {
  const userId = useAppSelector(getUserId)
  const name = useAppSelector(state => state.user.name)
  const avatarId = useAppSelector(state => state.user.avatarId)
  const { points, rank } = useAppSelector(myStanding)
  const nowSong = useAppSelector(getMyStageSong)
  const isUpNow = nowSong !== undefined
  const { position, rotationSize } = useAppSelector(getMyRotation)
  const songCount = useAppSelector(getMyUpcoming).length
  const { queueId: nextQueueId, wait, title: nextSong, artist: nextArtist } = useAppSelector(getMyNext)
  // the song whose alert was acknowledged; the next song alerts afresh
  const [ackedQueueId, setAckedQueueId] = useState<number>()

  // The meter's full scale is the singer's OWN wait when this song became their
  // next, remembered so it survives the wait ticking down. Measuring against the
  // room's furthest-out wait instead let other people's songs — queued BEHIND
  // this singer, unable to affect their wait at all — decide where their meter
  // started: someone six minutes out began two thirds full. Re-arms upward when
  // the wait grows, which is someone being inserted ahead of them.
  const [horizon, setHorizon] = useState<{ queueId?: number, wait: number }>({ wait: 0 })
  const isSameSong = nextQueueId === horizon.queueId
  const scale = wait === undefined
    ? horizon.wait
    : isSameSong ? Math.max(horizon.wait, wait) : wait

  if (wait !== undefined && (!isSameSong || wait > horizon.wait)) {
    setHorizon({ queueId: nextQueueId, wait })
  }

  const waitLevel = wait === undefined || scale <= 0
    ? undefined
    // floored so a singer who just queued reads as lit-but-low, not switched off
    : Math.max(0.06, 1 - wait / scale)

  const isPaused = useAppSelector(state => ensureState(state.queue).pausedUserIds.includes(userId))
  const roomName = useAppSelector(state => (
    state.user.roomId === null ? undefined : state.rooms.entities[state.user.roomId]?.name
  ))

  // Read off the room the way the QR overlay reads its own pref, and defaulted
  // to off: a room whose prefs have never been saved has no battles. The VS key
  // is drawn regardless (the design always draws it); off, a press says so.
  const isBattleEnabled = useAppSelector(state => (
    state.user.roomId === null
      ? false
      : state.rooms.entities[state.user.roomId]?.prefs?.battle?.isEnabled === true
  ))

  const isUpNext = wait !== undefined && wait <= UP_NEXT_ALERT_SECONDS && !isUpNow && !isPaused
    && nextQueueId !== ackedQueueId

  const location = useLocation()
  const path = location.pathname.replace(/\/$/, '')
  const isPlayer = path.endsWith('/player')
  const isScores = path.endsWith('/leaderboard')

  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const isChrome = userId !== null && !isPlayer

  return (
    <div className={styles.container} ref={ref}>
      {isChrome && (
        <div className={styles.brand}>
          <Logo withMark />
          <span className={styles.venue} translate='no'>{roomName}</span>
        </div>
      )}

      {isChrome && !isScores && (
        <YourTurn
          name={name}
          avatarId={avatarId}
          points={points}
          rank={rank}
          isUpNow={isUpNow}
          nowSong={nowSong}
          isPaused={isPaused}
          wait={wait === undefined ? undefined : formatSeconds(wait, true)}
          position={position}
          rotationSize={rotationSize}
          songCount={songCount}
          nextSong={nextSong}
          waitLevel={waitLevel}
          onTogglePaused={() => {
            dispatch(setPaused({ isPaused: !isPaused }))
            // both ways land on the queue: II shows the hold there (07c),
            // the play key and Resume show it running again (07)
            navigate('/queue')
          }}
          onBattle={isBattleEnabled ? onBattle : () => dispatch(showErrorMessage(BATTLES_OFF))}
        />
      )}

      {isChrome && isUpNext && (
        <UpNextAlert
          title={nextSong}
          artist={nextArtist}
          wait={wait}
          avatarId={avatarId}
          onReady={() => {
            setAckedQueueId(nextQueueId)
            navigate('/queue')
          }}
          onPause={() => {
            dispatch(setPaused({ isPaused: true }))
            navigate('/queue')
          }}
        />
      )}

      {/* only these two routes add a header of their own. Without the
          catch-all, react-router logs "No routes matched" on every render
          from /account, /settings and /. */}
      <Routes>
        <Route path='/library' element={<LibraryHeader />} />
        <Route path='/queue' element={<QueueHeader />} />
        <Route path='*' element={null} />
      </Routes>
    </div>
  )
})

Header.displayName = 'Header'

export default Header
