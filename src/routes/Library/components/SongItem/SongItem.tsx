import React from 'react'
import clsx from 'clsx'
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
  /** The starred-only list (04d): every row is drawn alike, queue state unshown. */
  isStarredView?: boolean
  /** A search is narrowing the list (04b): an unstarred row carries no star. */
  isSearchView?: boolean
}

/**
 * What a row is, reduced to the answers the render actually asks for.
 *
 * Pulled out because the row has three overlapping modes — normally browsing,
 * picking for a battle, and a room that cannot take a song at all — and each
 * one flips a different subset of the same flags. Read down the middle of a
 * render they were six interlocking ternaries; named here they are a table.
 */
const rowState = ({ isBattle, isMine, isUpcoming, isPlayed, isQueueBlocked, isStarredView }: {
  isBattle: boolean
  isMine: boolean
  isUpcoming: boolean
  isPlayed: boolean
  isQueueBlocked?: boolean
  isStarredView?: boolean
}) => {
  // The starred list (04d) draws every row alike: no mint well, no "Queued",
  // just the lit star. A row drawn like any other acts like any other, so a
  // song somebody else queued is not inert there either. Your own still comes
  // back out on a tap: the row toggles, as it does on 04.
  const isQueueShown = isUpcoming && !(isStarredView && !isBattle)

  // Normally a song somebody else has queued, or one the room has already sung,
  // is dead: tapping it would do nothing and the row says so rather than
  // swallowing the tap. In battle mode that rule is wrong — you are choosing
  // what your opponent has to sing, and the song you want is very often one
  // already in the queue or one the room heard an hour ago. Nothing is inert
  // while picking, and no tap removes anything either: a battle pick is not a
  // queue action and must not take somebody's own song back out from under them.
  //
  // A blocked room kills the tap outright, including taking your own song back
  // out: removing from the queue goes through the same room check the server
  // applies to adding, so offering it would be the same lie one row over.
  const isInert = !isBattle && (((isQueueShown || isPlayed) && !isMine) || !!isQueueBlocked)

  // The row's one word of state, when it has one. In battle mode it is the
  // instruction instead, on exactly the rows that would otherwise read as
  // unavailable — the star stays on every other row.
  const hasLabel = isQueueShown || (isBattle && isPlayed)

  // "Tap to remove" on a row whose tap does nothing is the same lie the whole
  // blocked state exists to stop telling.
  const label = isBattle ? 'Tap to pick' : (isMine && !isInert) ? 'Tap to remove' : 'Queued'

  return { isInert, hasLabel, label, isWell: isMine && isQueueShown }
}

/**
 * The library's unit of action (04): duration, title over "artist · genre ·
 * decade", and a tag on the right. The row is one key: a tap anywhere on it,
 * padding, duration and tag included, queues the song, and one more takes your
 * own back out. Your own queued song sits in the mint well and says "Tap to
 * remove"; somebody else's says "Queued" and goes inert; every other row
 * carries the star, the row's only other action and a key of its own.
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
  isQueueBlocked,
  myQueueId,
  battleForName,
  isStarredView,
  isSearchView,
}: SongItemProps) => {
  const isMine = myQueueId !== undefined
  const isBattle = !!battleForName
  const { isInert, hasLabel, label, isWell } = rowState({ isBattle, isMine, isUpcoming, isPlayed, isQueueBlocked, isStarredView })

  const handleClick = () => isMine && !isBattle ? onSongDequeue(myQueueId) : onSongQueue(songId)
  const handleStarClick = () => onSongStarClick(songId)

  // the design's 04 template: artist, then the first two tags (genre · decade)
  const meta = [artist, ...tags.slice(0, 2)].filter(Boolean).join(' · ')

  // 04b draws an empty tag on a search result nobody has queued: no star
  const hasStar = !hasLabel && !(isSearchView && !isStarred)

  return (
    <div
      className={clsx(
        styles.container,
        isWell && styles.mine,
        isPlayed && !isUpcoming && styles.played,
        isQueueBlocked && !isBattle && !isUpcoming && !isPlayed && styles.blocked,
      )}
    >
      <button
        type='button'
        onClick={isInert ? undefined : handleClick}
        disabled={isInert}
        aria-label={isBattle
          ? `Pick ${title} for ${battleForName}`
          : isMine ? `Remove ${title} from queue` : undefined}
        className={styles.primary}
      >
        <span className={styles.duration}>{formatDuration(duration)}</span>
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          {meta && <span className={styles.meta}>{meta}</span>}
        </span>
        {!hasStar && <span className={styles.queued}>{hasLabel ? label : null}</span>}
      </button>

      {hasStar && (
        <ButtonStar
          className={styles.btn}
          onClick={handleStarClick}
          isStarred={isStarred}
        />
      )}
    </div>
  )
}

export default SongItem
