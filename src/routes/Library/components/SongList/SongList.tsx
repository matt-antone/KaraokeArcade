import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { ensureState } from 'redux-optimistic-ui'
import SongItem from '../SongItem/SongItem'
import { queueSong, removeItem } from 'routes/Queue/modules/queue'
import { toggleSongStarred } from 'store/modules/userStars'
import { challengeSinger, getBattlePick, pickBattleSong } from 'store/modules/battle'
import getBattleTargetQueueId from 'routes/Queue/selectors/getBattleTargetQueueId'
import getSongsStatus from '../../selectors/getSongsStatus'
import getQueueBlocker from '../../selectors/getQueueBlocker'

interface SongListProps {
  filterKeywords?: string[]
  showArtist: boolean
  songIds: number[]
}

const SongList = (props: SongListProps) => {
  const dispatch = useAppDispatch()
  const artists = useAppSelector(state => state.artists.entities)
  const songs = useAppSelector(state => state.songs.entities)
  const starredSongs = useAppSelector(state => ensureState(state.userStars).starredSongs)
  const starredSongCounts = useAppSelector(state => state.starCounts.songs)
  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const { played, upcoming, current, mine } = useAppSelector(getSongsStatus)

  // The one question the library asks about battles. Selected down to a string
  // rather than taken as the object getBattlePick returns: that object is built
  // fresh on every call, so a component subscribing to it re-renders on every
  // action in the app — and this one is inside a virtualized list.
  const battleForName = useAppSelector(state => getBattlePick(state)?.forName ?? '')

  // Which half of the negotiation this device is in. `pending` is set only on
  // the challenger's phone and only before the challenge has been thrown, so it
  // is the whole discriminator: with it, this tap creates the challenge; without
  // it, this tap is the opponent answering one.
  const pendingUserId = useAppSelector(state => state.battle.pending?.userId ?? 0)
  const battleQueueId = useAppSelector(getBattleTargetQueueId)

  // Why a tap would be refused, or null. Not consulted while picking for a
  // battle: that tap names a song for somebody else and never reaches the
  // queue, so a paused room has no say in it.
  const queueBlocker = useAppSelector(getQueueBlocker)
  const isQueueBlocked = !battleForName && queueBlocker !== null

  const handleSongQueue = (songId: number) => {
    if (!battleForName) return dispatch(queueSong(songId))

    // The challenger spends the turn they already had — getBattleTargetQueueId
    // is 0 when they have none, and the server appends a fresh row instead.
    if (pendingUserId) return dispatch(challengeSinger(pendingUserId, songId, battleQueueId))

    dispatch(pickBattleSong(songId))
  }

  const handleSongDequeue = (queueId: number) => dispatch(removeItem({ queueId }))
  const handleSongStar = (songId: number) => dispatch(toggleSongStarred(songId))

  return props.songIds.map(songId => (
    <SongItem
      {...songs[songId]}
      artist={props.showArtist ? artists[songs[songId].artistId].name : ''}
      battleForName={battleForName}
      filterKeywords={props.filterKeywords}
      isPlayed={played.includes(songId)}
      isQueueBlocked={isQueueBlocked}
      isUpcoming={upcoming.includes(songId) || current === songId}
      myQueueId={mine[songId]}
      isStarred={starredSongs.includes(songId)}
      isAdmin={isAdmin}
      key={songId}
      numStars={starredSongCounts[songId] || 0}
      onSongQueue={handleSongQueue}
      onSongDequeue={handleSongDequeue}
      onSongStarClick={handleSongStar}
    />
  ))
}

export default SongList
