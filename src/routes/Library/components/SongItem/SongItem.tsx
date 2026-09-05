import React from 'react'
import clsx from 'clsx'
import Highlighter from 'react-highlight-words'
import ButtonStar from 'components/ButtonStar/ButtonStar'
import { formatDuration } from 'lib/dateTime'
import styles from './SongItem.css'

interface SongItemProps {
  songId: number
  artist?: string
  title: string
  tags: string[]
  duration: number
  onSongQueue(songId: number): void
  onSongDequeue(queueId: number): void
  onSongStarClick(songId: number): void
  isPlayed: boolean
  isStarred: boolean
  isUpcoming: boolean
  isAdmin: boolean
  /** Nothing this device queues would be accepted right now — no room, or a
   *  room that is not playing. The row goes inert like a played one; the star
   *  stays live, because starring never needed a room. */
  isQueueBlocked?: boolean
  /** Set when this song is the signed-in user's own upcoming item: tapping takes it back out. */
  myQueueId?: number
  /**
   * Who this device is currently picking a song FOR, or '' when it is browsing
   * normally. In battle mode every row is tappable and a tap means one thing
   * only: this is the song that person sings.
   */
  battleForName?: string
  numStars: number
  numMedia: number
  filterKeywords: string[]
}

/**
 * The library's unit of action: an un-queued song is a raised key, a queued
 * song drops to a teal standby well and goes inert, a played song loses its
 * key face entirely and dims down the ink ramp. One tap queues it, and one
 * more takes your own queued song back out — the star is the row's only
 * other action.
 */
const SongItem = ({
  songId,
  artist,
  title,
  tags,
  duration,
  onSongQueue,
  onSongDequeue,
  onSongStarClick,
  isPlayed,
  isStarred,
  isUpcoming,
  isAdmin,
  isQueueBlocked,
  myQueueId,
  battleForName,
  numStars,
  numMedia,
  filterKeywords,
}: SongItemProps) => {
  const isMine = myQueueId !== undefined

  // Normally a song somebody else has queued, or one the room has already sung,
  // is dead: tapping it would do nothing and the row says so rather than
  // swallowing the tap. In battle mode that rule is wrong — you are choosing
  // what your opponent has to sing, and the song you want is very often one
  // already in the queue or one the room heard an hour ago. Nothing is inert
  // while picking, and no tap removes anything either: a battle pick is not a
  // queue action and must not take somebody's own song back out from under them.
  const isBattle = !!battleForName
  // A blocked room kills the tap outright, including taking your own song back
  // out: removing from the queue goes through the same room check the server
  // applies to adding, so offering it would be the same lie one row over.
  const isInert = !isBattle && (((isUpcoming || isPlayed) && !isMine) || !!isQueueBlocked)
  const handleClick = () => isMine && !isBattle ? onSongDequeue(myQueueId) : onSongQueue(songId)
  const handleStarClick = () => onSongStarClick(songId)

  return (
    <div
      className={clsx(
        styles.container,
        isPlayed && styles.played,
        isUpcoming && styles.upcoming,
        isQueueBlocked && !isBattle && styles.blocked,
      )}
    >
      <div className={styles.duration}>
        {formatDuration(duration)}
      </div>

      <button
        type='button'
        onClick={isInert ? undefined : handleClick}
        disabled={isInert}
        aria-label={isBattle
          ? `Pick ${title} for ${battleForName}`
          : isMine ? `Remove ${title} from queue` : undefined}
        className={styles.primary}
      >
        {/* titles always show in full: they wrap, and the row grows to fit */}
        <span className={styles.title}>
          {filterKeywords?.length ? <Highlighter autoEscape textToHighlight={title} searchWords={filterKeywords} /> : title}
          {isAdmin && numMedia > 1 && <span className={styles.numMedia}>{` (${numMedia})`}</span>}
        </span>
        {(artist || tags.length > 0) && (
          <span className={styles.meta}>
            {[artist, tags.join(' · ')].filter(Boolean).join(' · ')}
          </span>
        )}
      </button>

      {/* The row's one word of state. In battle mode it is the instruction
          instead, on exactly the rows that would otherwise read as unavailable —
          the star stays on every other row so the list does not change height
          and PaddedList's measurement cache stays valid. */}
      {isUpcoming || (isBattle && isPlayed)
        ? (
            <span className={styles.queued}>
              {/* "tap to remove" on a row whose tap does nothing is the same
                  lie the whole blocked state exists to stop telling. */}
              {isBattle ? 'TAP TO PICK' : (isMine && !isInert) ? 'TAP TO REMOVE' : 'QUEUED'}
            </span>
          )
        : (
            <ButtonStar
              className={styles.btn}
              onClick={handleStarClick}
              isStarred={isStarred}
              count={numStars}
            />
          )}
    </div>
  )
}

export default SongItem
