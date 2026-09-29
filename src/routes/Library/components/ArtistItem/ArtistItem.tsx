import React from 'react'
import clsx from 'clsx'
import SongList from '../SongList/SongList'
import styles from './ArtistItem.css'

interface ArtistItemProps {
  artistSongIds: number[]
  isExpanded: boolean
  /** The letter group this artist opens ("#", "A"…), on the first of each group only. */
  letter?: string
  name: string
  onArtistClick: () => void
  style?: object
}

/**
 * A library artist row (06): name left, "22 songs" and a chevron right. Open,
 * the row lights like the design's active row and its songs follow inline.
 */
const ArtistItem = ({
  artistSongIds,
  isExpanded,
  letter,
  name,
  onArtistClick,
  style,
}: ArtistItemProps): React.ReactElement => (
  <div style={style} translate='no'>
    {letter && <div className={styles.letter}>{letter}</div>}

    <button
      type='button'
      onClick={onArtistClick}
      aria-expanded={isExpanded}
      className={clsx(styles.container, isExpanded && styles.open)}
    >
      <span className={styles.name}>{name}</span>
      <span className={styles.meta}>
        <span className={styles.count}>
          {artistSongIds.length}
          {artistSongIds.length === 1 ? ' song' : ' songs'}
        </span>
        <span className={styles.chevron} aria-hidden='true'>▸</span>
      </span>
    </button>

    {isExpanded && <SongList songIds={artistSongIds} showArtist={false} />}
  </div>
)

export default ArtistItem
