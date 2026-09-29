import React, { useCallback } from 'react'
import type { RootState } from 'store/store'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { toggleArtistResultExpanded } from '../../modules/library'
import getSearchResults from '../../selectors/getSearchResults'
import PaddedList from 'components/PaddedList/PaddedList'
import ArtistItem from '../ArtistItem/ArtistItem'
import type { RowComponentProps } from 'react-window'

// estimates only: rows are measured once rendered (see PaddedList)
const ROW_HEIGHT_ARTIST = 48 // see ArtistList
const ROW_HEIGHT_SONG = 67 // see SongResults

interface SearchResultsProps {
  ui: RootState['ui']
}

interface CustomRowProps {
  artists: RootState['artists']
  dispatch: ReturnType<typeof useAppDispatch>
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
  artistsResult,
  expandedArtistResults,
}: RowComponentProps<CustomRowProps>) => {
  const artistId = artistsResult[index]
  const artist = artists.entities[artistId]

  // ranked by match rather than by name, so no letter groups here
  return (
    <ArtistItem
      artistSongIds={artist.songIds}
      isExpanded={expandedArtistResults.includes(artistId)}
      key={artistId}
      name={artist.name}
      onArtistClick={() => dispatch(toggleArtistResultExpanded(artistId))}
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

  // stable identity: PaddedList keys its measurement cache off this function
  const rowHeight = useCallback((index: number) => {
    const artistId = artistsResult[index]
    let height = ROW_HEIGHT_ARTIST

    if (expandedArtistResults.includes(artistId)) {
      height += artists.entities[artistId].songIds.length * ROW_HEIGHT_SONG
    }

    return height
  }, [artists, artistsResult, expandedArtistResults])

  return (
    <PaddedList
      rowComponent={RowComponent}
      rowProps={{
        dispatch,
        artists,
        artistsResult,
        expandedArtistResults,
      }}
      rowHeight={rowHeight}
      cacheKey={filterStr}
      numRows={artistsResult.length}
      paddingTop={ui.headerHeight}
      paddingRight={0}
      paddingBottom={ui.footerHeight + 20}
      paddingLeft={0}
      height={ui.innerHeight}
    />
  )
}

export default SearchResults
