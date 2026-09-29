import React from 'react'
import { ensureState } from 'redux-optimistic-ui'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { setQueueTab, QueueTab } from 'store/modules/ui'
import Tabs from 'components/Tabs/Tabs'
import { isBattleItem, isTriviaItem } from 'shared/types'
import getQueueDisplay from '../../selectors/getQueueDisplay'
import getQueueSections from '../../selectors/getQueueSections'
import getRoundRobinQueue from '../../selectors/getRoundRobinQueue'
import NowSinging, { type NowSingingProps } from './NowSinging'
import styles from './QueueHeader.css'

/**
 * Three interfaces, not three filters: Queue is the rotation, History is what
 * the room has sung, Me is the singer's own songs plus their history.
 *
 * Above them, the stage: who is singing now. A singer who has paused sees the
 * hold notice in its place instead (07c); the key back in is the header's.
 */
const QueueHeader = () => {
  const dispatch = useAppDispatch()
  const tab = useAppSelector(state => state.ui.queueTab)
  const { played } = useAppSelector(getQueueSections)
  const { upcoming, mine } = useAppSelector(getQueueDisplay)
  const isPaused = useAppSelector(state => ensureState(state.queue).pausedUserIds.includes(state.user.userId as number))
  const queue = useAppSelector(getRoundRobinQueue)
  const { queueId, isAtQueueEnd } = useAppSelector(state => state.status)
  const songs = useAppSelector(state => state.songs)
  const artists = useAppSelector(state => state.artists)

  const current = isAtQueueEnd ? undefined : queue.entities[queueId]
  const song = current && !isTriviaItem(current) ? songs.entities[current.songId] : undefined

  let stage: NowSingingProps = { isEmpty: true }
  if (current && isTriviaItem(current)) {
    stage = { singer: 'Trivia', avatarId: null }
  } else if (current && song) {
    stage = {
      avatarId: isBattleItem(current) ? current.singerId : current.userAvatarId,
      singer: isBattleItem(current)
        ? `${current.userDisplayName} vs ${current.opponentDisplayName}`
        : current.userDisplayName,
      title: song.title,
      artist: artists.entities[song.artistId]?.name,
    }
  }

  return (
    <div className={styles.container}>
      {isPaused
        ? (
            <div className={styles.hold}>
              Your songs are on hold. Everyone else keeps singing, and you keep your place in line.
            </div>
          )
        : <NowSinging {...stage} />}

      <div className={styles.tabs}>
        <Tabs<QueueTab>
          active={tab}
          onChange={id => dispatch(setQueueTab(id))}
          tabs={[
            { id: 'queue', label: 'Queue', count: upcoming.length },
            { id: 'me', label: 'Me', count: mine.length },
            { id: 'history', label: 'History', count: played.length },
          ]}
        />
      </div>
    </div>
  )
}

export default QueueHeader
