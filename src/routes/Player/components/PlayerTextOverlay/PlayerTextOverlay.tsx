import React from 'react'
import CornerPanel from './CornerPanel/CornerPanel'
import SpriteLoop from 'components/SpriteLoop/SpriteLoop'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import VuMeter from 'components/VuMeter/VuMeter'
import { BATTLE_STAGE_PLATE, battleSingerOrDefault, battleSingerStage } from 'lib/battleSingers'
import useNow from 'lib/useNow'
import { isBattleItem, isTriviaItem, type QueueItem } from 'shared/types'
import overlayState from './overlayState'
import styles from './PlayerTextOverlay.css'

interface PlayerTextOverlayProps {
  queueItem?: QueueItem
  nextQueueItem?: QueueItem
  /** The three singers after the next one, shown on 11a. */
  comingUpQueueItems?: QueueItem[]
  /** Song title for each entry in comingUpQueueItems, same order. */
  comingUpSongTitles?: (string | undefined)[]
  songTitle?: string
  songArtist?: string
  nextSongTitle?: string
  nextSongArtist?: string
  isAtQueueEnd: boolean
  isQueueEmpty: boolean
  isErrored: boolean
  intermissionEndsAt?: number | null
  /** The room's name, top right of 11a. */
  venue?: string
  /** Seconds into the playing song, and its length (11b). */
  position?: number
  duration?: number
  /** The room's level for the 11b meter; see Player's analyser. */
  getAnalyser?: () => AnalyserNode | null
  width: number
  height: number
}

/** 11a's meter: the design draws it idle, 13 of 32 lit. */
const IDLE_LEVEL = 13 / 32

/** The rows that are not a singer: the next row's own screen names them. */
const isSingerRow = (item?: QueueItem): item is QueueItem => !!item && !isTriviaItem(item) && !isBattleItem(item)

// Before a battle the page stands down to its clock: the battle's own `versus`
// beat names both fighters and both songs, and this page can only name one.
// Mounted when the intermission starts, so `now` is seeded correctly (keyed on
// endsAt by the parent).
const LeadInClock = ({ endsAt }: { endsAt: number }) => {
  const now = useNow()
  const secondsLeft = Math.max(0, Math.ceil((endsAt - now) / 1000))

  return <div key={secondsLeft} className={styles.leadInCountdown} translate='no'>{secondsLeft}</div>
}

// 11a · on stage next: the singer dancing on their own stage, billed with their
// song, and the three after them along the bottom
const OnStageNext = ({
  venue,
  nextQueueItem,
  nextSongTitle,
  nextSongArtist,
  comingUpQueueItems = [],
  comingUpSongTitles = [],
}: {
  venue?: string
  nextQueueItem: QueueItem
  nextSongTitle?: string
  nextSongArtist?: string
  comingUpQueueItems?: QueueItem[]
  comingUpSongTitles?: (string | undefined)[]
}) => {
  const singer = battleSingerOrDefault(nextQueueItem.userAvatarId)

  return (
    <div className={styles.stage}>
      <div className={styles.scanlines} />
      {/* the shared plate under the location, for a fighter with no art */}
      <div
        className={styles.location}
        style={{ backgroundImage: `url('${battleSingerStage(singer)}'), url('${BATTLE_STAGE_PLATE}')` }}
      />
      <div className={styles.stageScrim} />
      <SpriteLoop singer={singer} loop='dance' size='107.4vh' facing='right' className={styles.dancer} />
      <img className={styles.logo} src='assets/arcade/logo.svg' alt='KaraokeArcade' />
      {venue && <span className={styles.venue} translate='no'>{venue}</span>}
      <div className={styles.billing} translate='no'>
        <span className={styles.billingLabel}>On stage next</span>
        <span className={styles.billingName}>{nextQueueItem.userDisplayName}</span>
        {nextSongTitle && <span className={styles.nextSongTitle}>{nextSongTitle}</span>}
        {nextSongArtist && <span className={styles.nextSongArtist}>{nextSongArtist}</span>}
        <VuMeter
          className={styles.billingMeter}
          value={IDLE_LEVEL}
          segments={32}
          peakFrom={28 / 32}
          height='2.22vh'
          gap='0.56vh'
        />
      </div>
      {comingUpQueueItems.length > 0 && (
        <div className={styles.comingUp} translate='no'>
          <span className={styles.comingUpHeading}>Up next</span>
          <div className={styles.comingUpCards}>
            {comingUpQueueItems.map((item, i) => (
              <div key={item.queueId} className={styles.comingUpCard}>
                <UserAvatar avatarId={item.userAvatarId} size={80} className={styles.comingUpAvatar} />
                <div className={styles.comingUpText}>
                  <span className={styles.comingUpSinger}>{item.userDisplayName}</span>
                  {comingUpSongTitles[i] && <span className={styles.comingUpTitle}>{comingUpSongTitles[i]}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * What the TV draws over the media for an ordinary song and the gaps between
 * them: 11a on stage next, 11b's bar and singer, and the fault. The idle and
 * empty states are the join screen's (PlayerJoin), which draws its own keys.
 */
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
  queueItem,
  venue,
  position = 0,
  duration = 0,
  getAnalyser,
  width,
  height,
}: PlayerTextOverlayProps) => {
  const state = overlayState({
    isQueueEmpty, isAtQueueEnd, nextQueueItem, queueItem, isErrored, intermissionEndsAt,
  })

  return (
    <div
      style={{ width, height }}
      className={styles.container}
    >
      {/* undesigned, and kept: the room has to know the media failed */}
      {state === 'errored' && (
        <div className={styles.fault}>
          <span className={styles.faultLabel}>Fault</span>
          <span className={styles.faultTitle}>Media failed</span>
          <span className={styles.faultNote}>See the queue for details.</span>
        </div>
      )}

      {/* A trivia round's splash (drawn behind this) owns its lead-in and its
          clock, so the page draws nothing before one. */}
      {state === 'intermission' && isBattleItem(nextQueueItem) && (
        <LeadInClock key={intermissionEndsAt} endsAt={intermissionEndsAt} />
      )}

      {state === 'intermission' && isSingerRow(nextQueueItem) && (
        <OnStageNext
          venue={venue}
          nextQueueItem={nextQueueItem}
          nextSongTitle={nextSongTitle}
          nextSongArtist={nextSongArtist}
          comingUpQueueItems={comingUpQueueItems}
          comingUpSongTitles={comingUpSongTitles}
        />
      )}

      {/* 11b · the bar for the whole song, and the singer singing it */}
      {state === 'playing' && (
        <>
          <CornerPanel
            singer={queueItem.userDisplayName}
            songTitle={songTitle}
            songArtist={songArtist}
            position={position}
            duration={duration}
            getAnalyser={getAnalyser}
            next={isSingerRow(nextQueueItem)
              ? { name: nextQueueItem.userDisplayName, avatarId: nextQueueItem.userAvatarId }
              : undefined}
          />
          <SpriteLoop
            singer={battleSingerOrDefault(queueItem.userAvatarId)}
            loop='sing'
            size='107.4vh'
            facing='right'
            className={styles.singer}
          />
        </>
      )}
    </div>
  )
}

export default PlayerTextOverlay
