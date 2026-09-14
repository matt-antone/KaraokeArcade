import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import screenfull from 'screenfull'
import { useAppDispatch } from 'store/hooks'
import { requestPlay } from 'store/modules/status'
import CornerPanel from './CornerPanel/CornerPanel'
import PlayerHeadline from './PlayerHeadline/PlayerHeadline'
import Icon from 'components/Icon/Icon'
import UserImage from 'components/UserImage/UserImage'
import VuMeter from 'components/VuMeter/VuMeter'
import useNow from 'lib/useNow'
import { isBattleItem, isTriviaItem, type QueueItem } from 'shared/types'
import styles from './PlayerTextOverlay.css'

/** How long the "on stage" panel names the singer at the top of a song. */
const UP_NOW_MS = 5000
/** Queue depth that fills the bottom meter. Beyond it the room just reads "long". */
const QUEUE_DEPTH_FULL = 20
/** Same-browser channel Settings' transport uses to ask for fullscreen once a
 * song is playing — the Fullscreen API can only be invoked from the document
 * that is going fullscreen, so this only reaches a Player tab in the same
 * browser as Settings. Must match Settings/components/Player/PlaybackCtrl. */

/** Six mutually exclusive states — never two at once. */
type OverlayState = 'upNow' | 'upNextTease' | 'intermission' | 'idle' | 'empty' | 'errored'

interface PlayerTextOverlayProps {
  queueItem?: QueueItem
  nextQueueItem?: QueueItem
  comingUpQueueItems?: QueueItem[]
  /** Song title for each entry in comingUpQueueItems, same order. */
  comingUpSongTitles?: (string | undefined)[]
  songTitle?: string
  songArtist?: string
  nextSongTitle?: string
  nextSongArtist?: string
  isSongEnding?: boolean
  isAtQueueEnd: boolean
  isQueueEmpty: boolean
  isErrored: boolean
  intermissionEndsAt?: number | null
  /** Songs still to come. Drives the bottom queue-depth meter. */
  queueDepth?: number
  width: number
  height: number
}

// mounted when the intermission starts, so `now` is seeded correctly (keyed on endsAt by the parent)
const Intermission = ({
  endsAt,
  nextQueueItem,
  nextSongTitle,
  nextSongArtist,
  comingUpQueueItems = [],
  comingUpSongTitles = [],
}: {
  endsAt: number
  nextQueueItem?: QueueItem
  nextSongTitle?: string
  nextSongArtist?: string
  comingUpQueueItems?: QueueItem[]
  comingUpSongTitles?: (string | undefined)[]
}) => {
  const now = useNow()
  const secondsLeft = Math.max(0, Math.ceil((endsAt - now) / 1000))

  // A trivia round is handed the stage by the mark drawn behind this overlay,
  // and the mark already says what is coming — in the round's own colours, with
  // TRIVIA on the nameplate. So the page stands down and leaves the clock: a
  // headline naming a singer nobody is waiting for, over the top of a card
  // saying the same thing, was two screens for one handover.
  //
  // A battle stands the page down for the same reason and a stronger one. Its
  // own `versus` beat opens by naming both fighters and both songs, which is
  // this page's whole content and better drawn — and this page can only name
  // one of the two, so it introduces a duel as though it were a solo. The
  // singer who *is* waiting for this screen is the one after the battle, and
  // that is where it now runs; see the battle row's ending in
  // PlayerController.
  if (isTriviaItem(nextQueueItem) || isBattleItem(nextQueueItem)) {
    return (
      <PlayerHeadline key={secondsLeft} className={styles.leadInCountdown}>
        {secondsLeft}
      </PlayerHeadline>
    )
  }

  // one order, always: next song, face, name, countdown, coming up
  return (
    <>
      {nextSongTitle && (
        <div className={styles.nextSong} translate='no'>
          <div className={styles.nextSongTitle}>{nextSongTitle}</div>
          {nextSongArtist && <div className={styles.nextSongArtist}>{nextSongArtist}</div>}
        </div>
      )}
      {nextQueueItem && (
        <UserImage
          userId={nextQueueItem.userId}
          dateUpdated={nextQueueItem.userDateUpdated}
          className={styles.nextUserImage}
        />
      )}
      <PlayerHeadline tone='vu'>{nextQueueItem ? nextQueueItem.userDisplayName : 'Up next'}</PlayerHeadline>
      <PlayerHeadline key={secondsLeft} size='var(--display-xl)' className={styles.countdown}>
        {secondsLeft}
      </PlayerHeadline>
      {comingUpQueueItems.length > 0 && (
        <div className={styles.comingUp} translate='no'>
          <div className={clsx('silkscreen', styles.comingUpHeading)}>coming up</div>
          {comingUpQueueItems.map((item, i) => {
            const title = comingUpSongTitles[i]
            return title ? `${item.userDisplayName} — ${title}` : item.userDisplayName
          }).join(', ')}
        </div>
      )}
    </>
  )
}

// The panel names who is on stage for the first seconds of a song, then clears out
// of the way. The parent keys us on queueId, so the next song starts the timer again.
const UpNow = ({ singer, songTitle, songArtist }: {
  singer: string
  songTitle?: string
  songArtist?: string
}) => {
  const [show, setShow] = useState(true)

  // requestAnimationFrame doesn't run while the player's tab is hidden, so the
  // reveal is never gated on one: the panel would outlive the timer that hides it
  useEffect(() => {
    const timeoutID = setTimeout(() => setShow(false), UP_NOW_MS)
    return () => clearTimeout(timeoutID)
  }, [])

  if (!show) return null

  return <CornerPanel label='on stage' tone='vu' singer={singer} songTitle={songTitle} songArtist={songArtist} />
}

const handleFullscreen = () => {
  if (screenfull.isEnabled) screenfull.request(document.getElementById('player-fs-container'))
}

/**
 * Which of the six states the stage is in. Its own function because it is a
 * priority ladder — the earlier tests win — and a ladder is much easier to
 * check for holes when it is not interleaved with the markup for its own
 * outcomes.
 */
const overlayState = ({ isQueueEmpty, isAtQueueEnd, nextQueueItem, queueItem, isErrored, intermissionEndsAt, isSongEnding }: {
  isQueueEmpty: boolean
  isAtQueueEnd: boolean
  nextQueueItem?: QueueItem
  queueItem?: QueueItem
  isErrored: boolean
  intermissionEndsAt?: number
  isSongEnding: boolean
}): OverlayState => {
  if (isQueueEmpty || (isAtQueueEnd && !nextQueueItem)) return 'empty'
  if (!queueItem || (isAtQueueEnd && nextQueueItem)) return 'idle'
  if (isErrored) return 'errored'
  if (intermissionEndsAt) return 'intermission'
  // Not before a battle: the corner panel names one singer, and a battle is two
  // of them. The stage is about to draw the pair properly.
  if (isSongEnding && nextQueueItem && !isBattleItem(nextQueueItem)) return 'upNextTease'

  return 'upNow'
}

const PlayerTextOverlay = ({
  isQueueEmpty,
  isAtQueueEnd,
  isErrored,
  intermissionEndsAt,
  nextQueueItem,
  comingUpQueueItems,
  comingUpSongTitles,
  songTitle,
  songArtist,
  nextSongTitle,
  nextSongArtist,
  isSongEnding,
  queueItem,
  queueDepth = 0,
  width,
  height,
}: PlayerTextOverlayProps) => {
  const dispatch = useAppDispatch()
  const handlePlay = () => dispatch(requestPlay())

  const state = overlayState({
    isQueueEmpty, isAtQueueEnd, nextQueueItem, queueItem, isErrored, intermissionEndsAt, isSongEnding,
  })

  // the fullscreen key only floats over the paused stage — nothing else
  // competes there. Playing states reach fullscreen via Settings' transport.
  const isFullscreenKeyShown = screenfull.isEnabled && !screenfull.isFullscreen && state === 'idle'

  return (
    <div
      style={{ width, height }}
      className={styles.container}
    >
      {state === 'empty' && (
        <>
          <div className={clsx('silkscreen', styles.stateLabel)}>queue empty</div>
          <PlayerHeadline tone='vu'>Add a song</PlayerHeadline>
        </>
      )}

      {state === 'errored' && (
        <>
          <div className={clsx('silkscreen', styles.stateLabel, styles.fault)}>fault</div>
          <PlayerHeadline>Media failed</PlayerHeadline>
          <div className={clsx('silkscreen', styles.stateFooter)}>see the queue for details</div>
        </>
      )}

      {/* browsers won't autoplay without a tap */}
      {state === 'idle' && (
        <button className={styles.playKey} onClick={handlePlay} aria-label='Play'>
          <Icon icon='PLAY' />
        </button>
      )}

      {isFullscreenKeyShown && (
        <button className={styles.fullscreenKey} onClick={handleFullscreen} aria-label='Fullscreen'>
          <Icon icon='FULLSCREEN' />
        </button>
      )}

      {state === 'intermission' && (
        <Intermission
          key={intermissionEndsAt}
          endsAt={intermissionEndsAt}
          nextQueueItem={nextQueueItem}
          nextSongTitle={nextSongTitle}
          nextSongArtist={nextSongArtist}
          comingUpQueueItems={comingUpQueueItems}
          comingUpSongTitles={comingUpSongTitles}
        />
      )}

      {state === 'upNow' && (
        <UpNow
          key={queueItem.queueId}
          singer={queueItem.userDisplayName}
          songTitle={songTitle}
          songArtist={songArtist}
        />
      )}

      {state === 'upNextTease' && (
        <CornerPanel
          label='up next'
          singer={nextQueueItem.userDisplayName}
          songTitle={nextSongTitle}
          songArtist={nextSongArtist}
        />
      )}

      {/* how long the list is, without anyone asking. Hidden when nothing is queued,
          and during the intermission, which is the one takeover. */}
      {queueDepth > 0 && state !== 'intermission' && (
        <div className={styles.queueDepth}>
          <span className={clsx('silkscreen', styles.queueDepthLabel)}>{`queue ${String(queueDepth).padStart(2, '0')}`}</span>
          <VuMeter
            value={Math.min(1, queueDepth / QUEUE_DEPTH_FULL)}
            segments={30}
            peakFrom={2}
            height={5}
            label='Songs still to come'
          />
        </div>
      )}
    </div>
  )
}

export default PlayerTextOverlay
