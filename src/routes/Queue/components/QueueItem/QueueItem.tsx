import React, { useState } from 'react'
import clsx from 'clsx'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import { useAppDispatch } from 'store/hooks'
import ButtonStar from 'components/ButtonStar/ButtonStar'
import Icon from 'components/Icon/Icon'
import SwipeRow from 'components/SwipeRow/SwipeRow'
import type { SwipeAction } from 'components/SwipeRow/constants'
import UserImage from 'components/UserImage/UserImage'
import { requestPlayNext, requestReplay } from 'store/modules/status'
import { toggleSongStarred } from 'store/modules/userStars'
import { showErrorMessage } from 'store/modules/ui'
import { removeItem, setKeyChange } from '../../modules/queue'
import SongSettings from '../SongSettings/SongSettings'
import { formatKeyChange } from '../SongSettings/formatKeyChange'
import styles from './QueueItem.css'

/** A just-started song still reads as started. */
const MIN_PCT = 2

interface QueueItemProps {
  artist: string
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  errorMessage: string
  isCurrent: boolean
  isErrored: boolean
  isMovable: boolean
  isOwner: boolean
  isPaused: boolean
  isPlayed: boolean
  isPlaying: boolean
  isRemovable: boolean
  isReplayable: boolean
  isSkippable: boolean
  isStarred: boolean
  /** Gear key: on the Me tab, for a song still yours to change. */
  isTunable: boolean
  isUpcoming: boolean
  /** Absent on an optimistic row until the server echoes it back. */
  keyChange?: number
  pctPlayed: number
  queueId: number
  songId: number
  starCount: number
  title: string
  userDateUpdated: number
  userDisplayName: string
  userId: number
  wait?: string
  /** Off on the Me tab, where the list is already your own songs. */
  showStar?: boolean
  onMoveClick(queueId: number): void
}

/**
 * Actions live *under* the row via SwipeRow, so the row's own content never
 * changes width and a long title is never squeezed by actions appearing. The
 * star stays on the row face: it is a state readout as much as an action.
 *
 * A played row gets no actions at all — a song sung tonight is locked for the
 * rest of the party. There is no info action anywhere: the row already shows
 * the title, artist and singer, which is everything anyone acts on.
 */
/**
 * The swipe keys a row offers, which is entirely a question of permissions.
 * Amber for constructive, red for destructive, and a played row is locked so
 * it gets none.
 *
 * Its own function because it is five independent permission checks that have
 * nothing to do with how the row draws, and they were the bulk of what made
 * the component read as complicated.
 */
const rowActions = (
  can: Pick<QueueItemProps, 'isPlayed' | 'isTunable' | 'isMovable' | 'isReplayable' | 'isSkippable' | 'isRemovable'>,
  on: {
    settings: () => void
    move: () => void
    replay: () => void
    skip: () => void
    remove: () => void
  },
): SwipeAction[] => {
  if (can.isPlayed) return []

  return [
    can.isTunable && { icon: 'COG', label: 'Settings', tone: 'panel', onClick: on.settings },
    can.isMovable && { icon: 'MOVE_TOP', label: 'Top', tone: 'vu', onClick: on.move },
    can.isReplayable && { icon: 'REPLAY', label: 'Replay', tone: 'alert', onClick: on.replay },
    can.isSkippable && { icon: 'PLAY_NEXT', label: 'Skip', tone: 'alert', onClick: on.skip },
    can.isRemovable && { icon: 'DELETE', label: 'Remove', tone: 'alert', onClick: on.remove },
  ].filter(Boolean) as SwipeAction[]
}

/** The chip over the avatar: how long until this row, or that it is on now.
 *  The current row reads NOW — without it the amber state is unreachable,
 *  since isUpcoming and isCurrent are exclusive. */
const WaitChip = ({ isCurrent, isUpcoming, isPaused, wait }: {
  isCurrent: boolean
  isUpcoming: boolean
  isPaused: boolean
  wait?: string
}) => {
  if (!isCurrent && !(isUpcoming && (wait || isPaused))) return null

  return (
    <div className={clsx(styles.wait, isCurrent && styles.waitIsCurrent)}>
      {isPaused ? <Icon icon='PAUSE' size={12} /> : isCurrent ? 'NOW' : wait}
    </div>
  )
}

const QueueItem = ({
  artist,
  dragHandleProps,
  errorMessage,
  isCurrent,
  isErrored,
  isMovable,
  isOwner,
  isPaused,
  isPlayed,
  isPlaying,
  isRemovable,
  isReplayable,
  isSkippable,
  isStarred,
  isTunable,
  isUpcoming,
  keyChange = 0,
  onMoveClick,
  pctPlayed,
  queueId,
  songId,
  starCount,
  showStar = true,
  title,
  userDateUpdated,
  userDisplayName,
  userId,
  wait,
}: QueueItemProps) => {
  const [isOpen, setOpen] = useState(false)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const dispatch = useAppDispatch()

  const actions = rowActions(
    { isPlayed, isTunable, isMovable, isReplayable, isSkippable, isRemovable },
    {
      settings: () => setSettingsOpen(true),
      move: () => onMoveClick(queueId),
      replay: () => dispatch(requestReplay(queueId)),
      skip: () => dispatch(requestPlayNext()),
      remove: () => dispatch(removeItem({ queueId })),
    },
  )

  const isSpent = isPlayed || isPaused

  return (
    <>
      <SwipeRow
        actions={actions}
        isOpen={isOpen}
        onOpenChange={setOpen}
        className={clsx(
          styles.shell,
          isOwner && styles.isOwner,
          isOwner && isPaused && styles.ownerPaused,
        )}
      >
        <div
          className={clsx(
            styles.container,
            isCurrent && !isPlaying && styles.paused,
            isSpent && styles.spent,
            isErrored && styles.errored,
          )}
          style={{ '--progress': `${isCurrent && pctPlayed < MIN_PCT ? MIN_PCT : pctPlayed}%` } as React.CSSProperties}
          // no info icon: an errored row surfaces its own message when tapped
          onClick={isErrored ? () => dispatch(showErrorMessage(errorMessage)) : undefined}
        >
          {isCurrent && (
            <>
              <div className={styles.fill} />
              <div className={styles.sweep} />
            </>
          )}

          {dragHandleProps && (
            <div className={styles.dragHandle} {...dragHandleProps}>
              <Icon icon='DRAG_INDICATOR' size={24} />
            </div>
          )}

          <div className={styles.imageContainer}>
            <UserImage userId={userId} dateUpdated={userDateUpdated} className={styles.avatar} />
            {/* the chip marks the playing row and the waits ahead of it */}
            <WaitChip isCurrent={isCurrent} isUpcoming={isUpcoming} isPaused={isPaused} wait={wait} />
          </div>

          <div className={styles.primary} translate='no'>
            <div className={styles.title}>{title}</div>
            <div className={styles.artist}>{artist}</div>
            <div className={clsx(styles.user, isOwner && styles.userIsOwner)}>{userDisplayName}</div>
          </div>

          {/* a shifted key is a fact about how this row will sound, so it reads
              on the row face rather than only inside the dialog that set it */}
          {keyChange !== 0 && (
            <div className={clsx('silkscreen', styles.keyChange)}>
              {`key ${formatKeyChange(keyChange)}`}
            </div>
          )}

          {showStar && (
            <ButtonStar
              className={styles.star}
              isStarred={isStarred}
              onClick={() => dispatch(toggleSongStarred(songId))}
              count={starCount}
            />
          )}
        </div>
      </SwipeRow>

      {/* outside SwipeRow: its slider is transformed, and a transformed
          ancestor becomes the containing block for a top-layer dialog */}
      {isSettingsOpen && (
        <SongSettings
          artist={artist}
          title={title}
          keyChange={keyChange}
          onChangeKey={next => dispatch(setKeyChange({ keyChange: next, queueId }))}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}

export default QueueItem
