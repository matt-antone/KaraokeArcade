import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { setQueueTab, QueueTab } from 'store/modules/ui'
import Tabs from 'components/Tabs/Tabs'
import { isBattleItem, isTriviaItem } from 'shared/types'
import getMyUpcoming from '../../selectors/getMyUpcoming'
import getQueueSections from '../../selectors/getQueueSections'
import getRoundRobinQueue from '../../selectors/getRoundRobinQueue'
import NowSinging, { type NowSingingProps } from './NowSinging'
import styles from './QueueHeader.css'

/**
 * Three interfaces, not three filters: Queue is the rotation, History is what
 * the room has sung, Me is the singer's own songs plus their history.
 *
 * Above them, the stage: who is singing now. Sitting out is shown once, in
 * the app header's your-turn strip, which also holds the key back in.
 */
const QueueHeader = () => {
  const dispatch = useAppDispatch()
  const tab = useAppSelector(state => state.ui.queueTab)
  const { played, upcoming } = useAppSelector(getQueueSections)
  const mine = useAppSelector(getMyUpcoming)
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
      <NowSinging {...stage} />

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
