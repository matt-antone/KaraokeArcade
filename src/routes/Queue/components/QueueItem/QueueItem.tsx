import React, { useState } from 'react'
import clsx from 'clsx'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import { useAppDispatch } from 'store/hooks'
import SwipeRow from 'components/SwipeRow/SwipeRow'
import type { SwipeAction } from 'components/SwipeRow/constants'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import { removeItem, setKeyChange } from '../../modules/queue'
import SongSettings from '../SongSettings/SongSettings'
import styles from './QueueItem.css'

interface QueueItemProps {
  artist: string
  /** The whole row is the handle: a long-press lifts it. Nothing on the face
   *  says so, because the design draws no handle. */
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  isMovable: boolean
  isOwner: boolean
  /** The singer has paused: the row keeps its place, in full colour, and the
   *  wait reads Hold (07c). */
  isPaused: boolean
  isPlayed: boolean
  isRemovable: boolean
  /** Gear key: on the Me tab, for a song still yours to change. */
  isTunable: boolean
  /** Absent on an optimistic row until the server echoes it back. */
  keyChange?: number
  /** The singer's points tonight, beside their name. */
  points: number
  /** 1-based place in the turns still to come. Absent on played rows. */
  position?: number
  queueId: number
  title: string
  userDisplayName: string
  /** Which fighter this singer is, off their account. An ordinary row follows
   *  the account; only a battle row follows its own snapshot. */
  userAvatarId: string | null
  wait?: string
  onMoveClick(queueId: number): void
}

/**
 * The swipe keys a row offers, which is entirely a question of permissions.
 * Amber for constructive, red for destructive, and a played row is locked so
 * it gets none.
 */
const rowActions = (
  can: Pick<QueueItemProps, 'isPlayed' | 'isTunable' | 'isMovable' | 'isRemovable'>,
  on: {
    settings: () => void
    move: () => void
    remove: () => void
  },
): SwipeAction[] => {
  if (can.isPlayed) return []

  return [
    can.isTunable && { icon: 'COG', label: 'Settings', tone: 'panel', onClick: on.settings },
    can.isMovable && { icon: 'MOVE_TOP', label: 'Top', tone: 'vu', onClick: on.move },
    can.isRemovable && { icon: 'DELETE', label: 'Remove', tone: 'alert', onClick: on.remove },
  ].filter(Boolean) as SwipeAction[]
}

/**
 * A turn still to come (07), or one sung tonight (History). Place, face,
 * title, artist, "singer · points", wait: nothing else is on the face. The
 * actions live under it via SwipeRow, so the face never changes width.
 */
const QueueItem = ({
  artist,
  dragHandleProps,
  isMovable,
  isOwner,
  isPaused,
  isPlayed,
  isRemovable,
  isTunable,
  keyChange = 0,
  onMoveClick,
  points,
  position,
  queueId,
  title,
  userAvatarId,
  userDisplayName,
  wait,
}: QueueItemProps) => {
  const [isOpen, setOpen] = useState(false)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const dispatch = useAppDispatch()

  const actions = rowActions(
    { isPlayed, isTunable, isMovable, isRemovable },
    {
      settings: () => setSettingsOpen(true),
      move: () => onMoveClick(queueId),
      remove: () => dispatch(removeItem({ queueId })),
    },
  )

  return (
    <>
      <SwipeRow
        actions={actions}
        isOpen={isOpen}
        onOpenChange={setOpen}
        className={clsx(styles.shell, isOwner && styles.isOwner)}
      >
        <div className={clsx(styles.container, isPlayed && styles.spent)} {...dragHandleProps}>
          {position !== undefined && <div className={styles.position}>{position}</div>}

          <UserAvatar avatarId={userAvatarId} className={styles.avatar} />

          <div className={styles.primary} translate='no'>
            <div className={styles.title}>{title}</div>
            <div className={styles.artist}>{artist}</div>
            <div className={clsx(styles.user, isOwner && styles.userIsOwner)}>
              {`${userDisplayName} · ${points}`}
            </div>
          </div>

          {(isPaused || wait) && (
            <div className={clsx(styles.wait, isPaused && styles.held)}>
              {isPaused ? 'Hold' : wait}
            </div>
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
