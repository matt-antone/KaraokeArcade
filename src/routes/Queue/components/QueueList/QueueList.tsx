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
import { moveItem } from '../../modules/queue'
import getMyUpcoming from '../../selectors/getMyUpcoming'
import getPlayerHistory from '../../selectors/getPlayerHistory'
import getQueueSections from '../../selectors/getQueueSections'
import getRoundRobinQueue from '../../selectors/getRoundRobinQueue'
import getWaits from '../../selectors/getWaits'

const QueueList = () => {
  const artists = useAppSelector(state => state.artists)
  const { errorMessage, isAtQueueEnd, isErrored, isPlaying, position, queueId } = useAppSelector(state => state.status)

  const playerHistory = useAppSelector(getPlayerHistory)
  const queue = useAppSelector(getRoundRobinQueue)
  const sections = useAppSelector(getQueueSections)
  const myUpcoming = useAppSelector(getMyUpcoming)
  const pausedUserIds = useAppSelector(state => ensureState(state.queue).pausedUserIds)
  const songs = useAppSelector(state => state.songs)
  const starredSongs = useAppSelector(state => ensureState(state.userStars).starredSongs)
  const starCounts = useAppSelector(state => state.starCounts)
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

  // "queue"/"me" are upcoming only; "history" is what's been sung, newest first
  const result = queueTab === 'history'
    ? [...sections.played].reverse()
    : queueTab === 'me'
      ? myUpcoming
      : sections.upcoming

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

  /** Where a row sits relative to the player: on stage, still to come, or done.
   *  Every row kind asks this and only this before anything else. */
  const placeOf = (qId: number) => ({
    isCurrent: (qId === queueId) && !isAtQueueEnd,
    isUpcoming: qId !== queueId && !playerHistory.includes(qId),
    isPlayed: qId !== queueId && playerHistory.includes(qId),
  })

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

  /** Which of a song row's actions this viewer may reach. Ten booleans off the
   *  same four facts, and none of them about how the row draws. */
  const songRowFlags = (item: QueueItemData, isCurrent: boolean, isUpcoming: boolean) => {
    const isOwner = item.userId === user.userId
    const isPaused = isUpcoming && pausedUserIds.includes(item.userId)

    return {
      isOwner,
      isPaused,
      isMovable: isUpcoming && !isPaused && user.isAdmin && queueTab !== 'me',
      isPlayed: !isUpcoming && !isCurrent,
      isPlaying: isCurrent && isPlaying,
      isRemovable: isUpcoming && (isOwner || user.isAdmin),
      isReplayable: (!isUpcoming || isCurrent) && (user.isAdmin || isOwner),
      isSkippable: isCurrent && (user.isAdmin || isOwner),
      // Me tab only: elsewhere the row already carries up to four keys, and a
      // fifth puts the row past the travel a swipe can comfortably cover
      isTunable: queueTab === 'me' && isUpcoming && isOwner,
    }
  }

  const renderSong = (qId: number, item: QueueItemData, dragHandleProps?: DraggableProvidedDragHandleProps | null) => {
    const { isCurrent, isUpcoming } = placeOf(qId)
    const flags = songRowFlags(item, isCurrent, isUpcoming)
    const duration = songs.entities[item.songId].duration

    return (
      <QueueItem
        {...item}
        {...flags}
        artist={artists.entities[songs.entities[item.songId].artistId].name}
        dragHandleProps={dragHandleProps}
        errorMessage={isCurrent && errorMessage ? errorMessage : ''}
        isCurrent={isCurrent}
        key={qId}
        isErrored={isCurrent && isErrored}
        isStarred={starredSongs.includes(item.songId)}
        isUpcoming={isUpcoming}
        pctPlayed={isCurrent ? position / duration * 100 : 0}
        showStar={queueTab !== 'me'}
        starCount={starCounts.songs[item.songId] || 0}
        title={songs.entities[item.songId].title}
        wait={flags.isPaused ? '' : formatSeconds(waits[qId], true)} // fuzzy
        // actions
        onMoveClick={handleMoveClick}
      />
    )
  }

  const renderItem = (qId: number, dragHandleProps?: DraggableProvidedDragHandleProps | null) => {
    const item = queue.entities[qId]
    const { isCurrent, isPlayed } = placeOf(qId)

    // a round has no song to read a duration or an artist from, and none of
    // the row's actions apply to it
    if (isTriviaItem(item)) {
      return <QueueTriviaItem key={qId} isCurrent={isCurrent} isPlayed={isPlayed} />
    }

    // Two singers and two songs, so nothing in renderSong applies: it reads a
    // single duration off a single songId, which for a battle would silently
    // describe half the row. Its own component, for the same reason a round
    // has one.
    if (isBattleItem(item)) {
      return (
        <QueueBattleItem
          key={qId}
          isCurrent={isCurrent}
          isPlayed={isPlayed}
          challenger={{
            userId: item.userId,
            name: item.userDisplayName,
            dateUpdated: item.userDateUpdated,
            singerId: item.singerId,
            avatarId: item.userAvatarId,
            ...songNameOf(item.songId),
          }}
          opponent={{
            userId: item.opponentUserId,
            name: item.opponentDisplayName,
            dateUpdated: item.opponentDateUpdated,
            singerId: item.opponentSingerId,
            avatarId: item.opponentAvatarId,
            ...songNameOf(item.opponentSongId),
          }}
        />
      )
    }

    return renderSong(qId, item, dragHandleProps)
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
                  // console error on every render.
                  isDragDisabled={isTriviaItem(queue.entities[qId]) || isBattleItem(queue.entities[qId])}
                >
                  {dragProvided => (
                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                      {renderItem(qId, dragProvided.dragHandleProps)}
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

  return <QueueListAnimator queueItems={result.map(qId => renderItem(qId))} />
}

export default QueueList
