import React from 'react'
import { DragDropContext, Draggable, Droppable, DropResult, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { ensureState } from 'redux-optimistic-ui'
import QueueBattleItem from '../QueueBattleItem/QueueBattleItem'
import QueueItem from '../QueueItem/QueueItem'
import QueueTriviaItem from '../QueueTriviaItem/QueueTriviaItem'
import QueueListAnimator from '../QueueListAnimator/QueueListAnimator'
import { formatSeconds } from 'lib/dateTime'
import { isBattleItem, isTriviaItem, type QueueItem as QueueItemData } from 'shared/types'
import { nightPointsByUser } from 'store/selectors/points'
import { moveItem } from '../../modules/queue'
import getQueueDisplay from '../../selectors/getQueueDisplay'
import getQueueSections from '../../selectors/getQueueSections'
import getRoundRobinQueue from '../../selectors/getRoundRobinQueue'
import getWaits from '../../selectors/getWaits'

const QueueList = () => {
  const artists = useAppSelector(state => state.artists)
  const queueId = useAppSelector(state => state.status.queueId)

  const queue = useAppSelector(getRoundRobinQueue)
  const sections = useAppSelector(getQueueSections)
  const display = useAppSelector(getQueueDisplay)
  const pausedUserIds = useAppSelector(state => ensureState(state.queue).pausedUserIds)
  const points = useAppSelector(nightPointsByUser)
  const songs = useAppSelector(state => state.songs)
  const user = useAppSelector(state => state.user)
  const waits = useAppSelector(getWaits)
  const queueTab = useAppSelector(state => state.ui.queueTab)

  // actions
  const dispatch = useAppDispatch()
  const handleMoveClick = (qId: number) => {
    // reference user's last-played item as the new prevQueueId
    const userId = queue.entities[qId].userId
    let lastPlayed = queueId // default in case user has no played items

    for (let i = queue.result.indexOf(queueId); i >= 0; i--) {
      if (isTriviaItem(queue.entities[queue.result[i]])) continue
      if (queue.entities[queue.result[i]].userId === userId) {
        lastPlayed = queue.result[i]
        break
      }
    }

    dispatch(moveItem({ queueId: qId, prevQueueId: lastPlayed }))
  }

  // "queue"/"me" are the turns still to come, never the song on stage (the
  // banner has it); "history" is what's been sung, newest first
  const result = queueTab === 'history'
    ? [...sections.played].reverse()
    : queueTab === 'me'
      ? display.mine
      : display.upcoming

  // reorder my own upcoming songs; the item lands after the one now above it
  const handleDragEnd = ({ source, destination }: DropResult) => {
    if (!destination || destination.index === source.index) return

    const qId = result[source.index]
    const rest = result.filter(id => id !== qId)

    if (destination.index === 0) {
      handleMoveClick(qId) // same as "move to top"
    } else {
      dispatch(moveItem({ queueId: qId, prevQueueId: rest[destination.index - 1] }))
    }
  }

  // every Queue and Me row is still to come; every History row is done
  const isUpcoming = queueTab !== 'history'

  /** A battle can reach a song this device has never loaded — the library
   *  arrives by artist — so an absent title is an ordinary state here, not a
   *  bug to crash on. */
  const songNameOf = (songId: number) => {
    const song = songs.entities[songId]

    return {
      title: song?.title ?? 'Their song',
      artist: song ? artists.entities[song.artistId]?.name ?? '' : '',
    }
  }

  /** Which of a song row's actions this viewer may reach: permissions, none
   *  of them about how the row draws. A paused singer's row is held (07c). */
  const songRowFlags = (item: QueueItemData) => {
    const isOwner = item.userId === user.userId
    const isPaused = isUpcoming && pausedUserIds.includes(item.userId)

    return {
      isOwner,
      isPaused,
      isMovable: isUpcoming && !isPaused && user.isAdmin && queueTab !== 'me',
      isPlayed: !isUpcoming,
      isRemovable: isUpcoming && (isOwner || user.isAdmin),
      // Me tab only: elsewhere the row already carries two keys, and a third
      // is past the travel a swipe can comfortably cover
      isTunable: queueTab === 'me' && isUpcoming && isOwner,
    }
  }

  const renderSong = (qId: number, item: QueueItemData, position?: number, dragHandleProps?: DraggableProvidedDragHandleProps | null) => {
    const flags = songRowFlags(item)

    return (
      <QueueItem
        {...item}
        {...flags}
        artist={artists.entities[songs.entities[item.songId].artistId].name}
        dragHandleProps={dragHandleProps}
        key={qId}
        points={points[item.userId] ?? 0}
        position={position}
        title={songs.entities[item.songId].title}
        wait={isUpcoming && !flags.isPaused ? formatSeconds(waits[qId], true) : undefined} // fuzzy
        // actions
        onMoveClick={handleMoveClick}
      />
    )
  }

  // 1, 2, 3 down the turns still to come. History has no line to be in.
  const renderItem = (qId: number, i: number, dragHandleProps?: DraggableProvidedDragHandleProps | null) => {
    const item = queue.entities[qId]
    const isPlayed = !isUpcoming
    const position = isUpcoming ? i + 1 : undefined

    // a round has no song to read a duration or an artist from, and none of
    // the row's actions apply to it
    if (isTriviaItem(item)) {
      return <QueueTriviaItem key={qId} isPlayed={isPlayed} position={position} />
    }

    // Two singers and two songs, so nothing in renderSong applies: it reads a
    // single duration off a single songId, which for a battle would silently
    // describe half the row. Its own component, for the same reason a round
    // has one.
    if (isBattleItem(item)) {
      return (
        <QueueBattleItem
          key={qId}
          isPlayed={isPlayed}
          position={position}
          challenger={{
            userId: item.userId,
            name: item.userDisplayName,
            singerId: item.singerId,
            avatarId: item.userAvatarId,
            ...songNameOf(item.songId),
          }}
          opponent={{
            userId: item.opponentUserId,
            name: item.opponentDisplayName,
            singerId: item.opponentSingerId,
            avatarId: item.opponentAvatarId,
            ...songNameOf(item.opponentSongId),
          }}
        />
      )
    }

    return renderSong(qId, item, position, dragHandleProps)
  }

  if ((queueTab === 'me' || (queueTab === 'queue' && user.isAdmin)) && result.length > 1) {
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId='myQueue'>
          {provided => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {result.map((qId, i) => (
                <Draggable
                  draggableId={String(qId)}
                  index={i}
                  key={qId}
                  // A round is the server's to place, not a singer's to drag,
                  // and a battle belongs to two people — dragging it would move
                  // somebody else's turn along with your own. Disabling it here
                  // rather than leaving the row without a handle: dnd asserts
                  // every enabled Draggable has one, and the assert fires as a
                  // console error on every render. A held row keeps its place
                  // until its singer is back, so it does not move either.
                  isDragDisabled={isTriviaItem(queue.entities[qId]) || isBattleItem(queue.entities[qId])
                    || (queueTab === 'queue' && pausedUserIds.includes(queue.entities[qId].userId))}
                >
                  {dragProvided => (
                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                      {renderItem(qId, i, dragProvided.dragHandleProps)}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    )
  }

  return <QueueListAnimator queueItems={result.map((qId, i) => renderItem(qId, i))} />
}

export default QueueList
