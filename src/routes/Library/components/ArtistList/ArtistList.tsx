import React, { useCallback, useEffect, useRef } from 'react'
import type { RootState } from 'store/store'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { scrollArtists, toggleArtistExpanded } from '../../modules/library'
import PaddedList from 'components/PaddedList/PaddedList'
import ArtistItem from '../ArtistItem/ArtistItem'
import type { ListImperativeAPI, RowComponentProps } from 'react-window'

// estimates only: rows are measured once rendered (see PaddedList)
const ROW_HEIGHT_ARTIST = 48 // 12 + 17px name + 12, plus the 2px seam
const ROW_HEIGHT_LETTER = 31 // 12 + 12px Silkscreen + 4
const ROW_HEIGHT_SONG = 67 // see SongResults

// the design's groups: "#" for anything that does not open with a letter
const letterOf = (name: string) => /^[a-z]/i.test(name) ? name[0].toUpperCase() : '#'

/** The letter row `index` opens, or undefined when it continues its group. */
const letterAt = (artists: RootState['artists'], index: number) => {
  const letter = letterOf(artists.entities[artists.result[index]].name)

  return index === 0 || letterOf(artists.entities[artists.result[index - 1]].name) !== letter
    ? letter
    : undefined
}

interface ArtistListProps {
  ui: RootState['ui']
}

interface CustomRowProps {
  dispatch: ReturnType<typeof useAppDispatch>
  artists: RootState['artists']
  expandedArtists: number[]
}

// this is outside the ArtistList component to keep the reference as stable as possible,
// as react-window will re-render the list (breaking animations) when RowComponent changes
const RowComponent = ({
  index,
  style,
  // below are also used in ArtistList and passed via rowProps to avoid duplicate effort
  dispatch,
  artists,
  expandedArtists,
}: RowComponentProps<CustomRowProps>) => {
  const artist = artists.entities[artists.result[index]]

  return (
    <ArtistItem
      artistSongIds={artist.songIds} // "children"
      isExpanded={expandedArtists.includes(artist.artistId)}
      key={artist.artistId}
      letter={letterAt(artists, index)}
      name={artist.name}
      onArtistClick={() => dispatch(toggleArtistExpanded(artist.artistId))}
      style={style}
    />
  )
}

const ArtistList = ({
  ui,
}: ArtistListProps) => {
  const dispatch = useAppDispatch()
  const { expandedArtists } = useAppSelector(state => state.library)
  const scrollRow = useAppSelector(state => state.library.scrollRow)
  const artists = useAppSelector(state => state.artists)

  const lastScrollRow = useRef(scrollRow)
  const list = useRef<ListImperativeAPI | null>(null)

  useEffect(() => {
    return () => {
      dispatch(scrollArtists(lastScrollRow.current))
    }
  }, [dispatch])

  // stable identity: PaddedList keys its measurement cache off this function
  const rowHeight = useCallback((index: number) => {
    const artistId = artists.result[index]
    let height = ROW_HEIGHT_ARTIST

    if (letterAt(artists, index)) height += ROW_HEIGHT_LETTER

    if (expandedArtists.includes(artistId)) {
      height += artists.entities[artistId].songIds.length * ROW_HEIGHT_SONG
    }

    return height
  }, [artists, expandedArtists])

  const handleRowsRendered = ({ startIndex }: { startIndex: number }) => {
    lastScrollRow.current = startIndex
  }

  const handleRef = (ref: ListImperativeAPI | null) => {
    if (ref) {
      list.current = ref

      if (lastScrollRow.current) {
        list.current.scrollToRow({ index: lastScrollRow.current, align: 'start', behavior: 'instant' })
      }
    }
  }

  if (artists.result.length === 0) return null

  // full-bleed rows; the header's own 8px band sits between them and the tabs (06)
  return (
    <PaddedList
      rowComponent={RowComponent}
      rowProps={{ dispatch, artists, expandedArtists }}
      rowHeight={rowHeight}
      numRows={artists.result.length}
      onRowsRendered={handleRowsRendered}
      onRef={handleRef}
      paddingTop={ui.headerHeight}
      paddingRight={0}
      paddingBottom={ui.footerHeight + 20}
      paddingLeft={0}
      width={ui.innerWidth}
      height={ui.innerHeight}
    />
  )
}

export default ArtistList
