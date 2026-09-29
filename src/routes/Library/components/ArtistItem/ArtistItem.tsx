import React from 'react'
import clsx from 'clsx'
import Highlighter from 'react-highlight-words'
import SongList from '../SongList/SongList'
import styles from './ArtistItem.css'

interface ArtistItemProps {
  artistSongIds: number[]
  filterKeywords?: string[]
  isExpanded: boolean
  name: string
  numStars: number
  onArtistClick: () => void
  starredSongs: number[]
  style?: object
  upcomingSongs: number[]
}

const ArtistItem = ({
  artistSongIds,
  filterKeywords,
  isExpanded,
  name,
  onArtistClick,
  starredSongs,
  style,
  upcomingSongs,
}: ArtistItemProps): React.ReactElement => {
  const isChildUpcoming = artistSongIds.some(songId => upcomingSongs.includes(songId))
  const isChildStarred = artistSongIds.some(songId => starredSongs.includes(songId))

  return (
    <div style={style} translate='no'>
      <button
        type='button'
        onClick={onArtistClick}
        aria-expanded={isExpanded}
        className={styles.container}
      >
        <span className={clsx(styles.name, isChildUpcoming && styles.upcoming)}>
          {filterKeywords?.length ? <Highlighter autoEscape textToHighlight={name} searchWords={filterKeywords} /> : name}
        </span>
        <span className={styles.meta}>
          <span className={clsx(styles.count, isChildStarred && styles.countStarred)}>{artistSongIds.length}</span>
          <span className={clsx(styles.chevron, isExpanded && styles.chevronOpen)} aria-hidden='true'>▸</span>
        </span>
      </button>

      {isExpanded && (
        <SongList
          songIds={artistSongIds}
          showArtist={false}
          filterKeywords={filterKeywords}
        />
      )}
    </div>
  )
}

export default ArtistItem
