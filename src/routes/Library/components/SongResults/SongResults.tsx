import React from 'react'
import type { RootState } from 'store/store'
import { useAppSelector } from 'store/hooks'
import getSearchResults from '../../selectors/getSearchResults'
import PaddedList from 'components/PaddedList/PaddedList'
import SongList from '../SongList/SongList'
import type { RowComponentProps } from 'react-window'

// estimate only: rows are measured once rendered (see PaddedList).
// 12 + 17px title + 2 + 13px meta + 12, plus the 2px seam
const ROW_HEIGHT_SONG_WITH_ARTIST = 67

// stable identity: PaddedList keys its measurement cache off this function
const rowHeight = () => ROW_HEIGHT_SONG_WITH_ARTIST

interface SongResultsProps {
  ui: RootState['ui']
}

interface CustomRowProps {
  songsResult: number[]
}

// outside the component to keep the reference stable; react-window
// re-renders the whole list (breaking animations) when it changes
const RowComponent = ({
  index,
  style,
  songsResult,
}: RowComponentProps<CustomRowProps>) => (
  <div style={style}>
    <SongList songIds={[songsResult[index]]} showArtist />
  </div>
)

const SongResults = ({ ui }: SongResultsProps) => {
  const filterStr = useAppSelector(state => state.library.filterStr)
  const { songsResult } = useAppSelector(getSearchResults)

  // full-bleed rows; the header's own 8px band sits between them and the tabs (04)
  return (
    <PaddedList
      rowComponent={RowComponent}
      rowProps={{ songsResult }}
      rowHeight={rowHeight}
      cacheKey={filterStr}
      numRows={songsResult.length}
      paddingTop={ui.headerHeight}
      paddingRight={0}
      paddingBottom={ui.footerHeight + 20}
      paddingLeft={0}
      height={ui.innerHeight}
    />
  )
}

export default SongResults
