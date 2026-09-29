import React, { useCallback, useRef } from 'react'
import { ensureState } from 'redux-optimistic-ui'
import type { RootState } from 'store/store'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { toggleArtistResultExpanded } from '../../modules/library'
import getSearchResults from '../../selectors/getSearchResults'
import getSongsStatus from '../../selectors/getSongsStatus'
import PaddedList from 'components/PaddedList/PaddedList'
import ArtistItem from '../ArtistItem/ArtistItem'
import type { ListImperativeAPI, RowComponentProps } from 'react-window'

// estimates only: rows are measured once rendered (see PaddedList), because a
// song title always shows in full and a wrapped title makes the row taller
const ROW_HEIGHT_ARTIST = 46 // --row-artist, seam rule included
const ROW_HEIGHT_SONG = 56 // --row-song, seam rule included

interface SearchResultsProps {
  ui: RootState['ui']
}

interface CustomRowProps {
  artists: RootState['artists']
  dispatch: ReturnType<typeof useAppDispatch>
  filterKeywords: string[]
  artistsResult: number[]
  expandedArtistResults: number[]
}

// this is outside the SearchResults component to keep the reference as stable as possible,
// as react-window will re-render the list (breaking animations) when RowComponent changes
const RowComponent = ({
  index,
  style,
  // below are also used in SearchResults and passed via rowProps to avoid duplicate effort
  dispatch,
  artists,
  filterKeywords,
  artistsResult,
  expandedArtistResults,
}: RowComponentProps<CustomRowProps>) => {
  const { starredSongs } = useAppSelector(state => ensureState(state.userStars))
  const { upcoming } = useAppSelector(getSongsStatus)

  const artistId = artistsResult[index]
  const artist = artists.entities[artistId]

  return (
    <ArtistItem
      artistSongIds={artist.songIds}
      filterKeywords={filterKeywords}
      isExpanded={expandedArtistResults.includes(artistId)}
      key={artistId}
      name={artist.name}
      numStars={0}
      onArtistClick={() => dispatch(toggleArtistResultExpanded(artistId))}
      upcomingSongs={upcoming}
      starredSongs={starredSongs}
      style={style}
    />
  )
}

const SearchResults = ({ ui }: SearchResultsProps) => {
  const dispatch = useAppDispatch()
  const artists = useAppSelector(state => state.artists)
  const expandedArtistResults = useAppSelector(state => state.library.expandedArtistResults)
  const filterStr = useAppSelector(state => state.library.filterStr)
  const { artistsResult } = useAppSelector(getSearchResults)

  const listRef = useRef<ListImperativeAPI | null>(null)
  const filterKeywords = filterStr.trim() ? filterStr.trim().toLowerCase().split(' ') : []

  // stable identity: PaddedList keys its measurement cache off this function
  const rowHeight = useCallback((index: number) => {
    const artistId = artistsResult[index]
    let height = ROW_HEIGHT_ARTIST

    if (expandedArtistResults.includes(artistId)) {
      height += artists.entities[artistId].songIds.length * ROW_HEIGHT_SONG
    }

    return height
  }, [artists, artistsResult, expandedArtistResults])

  const handleRef = (ref: ListImperativeAPI) => {
    if (ref) listRef.current = ref
  }

  return (
    <PaddedList
      rowComponent={RowComponent}
      rowProps={{
        dispatch,
        artists,
        filterKeywords,
        artistsResult,
        expandedArtistResults,
      }}
      rowHeight={rowHeight}
      cacheKey={filterStr}
      numRows={artistsResult.length}
      paddingTop={ui.headerHeight + 14}
      paddingRight={4}
      paddingBottom={ui.footerHeight + 20}
      paddingLeft={14}
      height={ui.innerHeight}
      onRef={handleRef}
    />
  )
}

export default SearchResults
