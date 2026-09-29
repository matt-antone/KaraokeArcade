import React, { useState } from 'react'
import { useAppSelector } from 'store/hooks'
import { Link } from 'react-router'
import ArtistList from '../components/ArtistList/ArtistList'
import SearchResults from '../components/SearchResults/SearchResults'
import SongResults from '../components/SongResults/SongResults'
import getSearchResults from '../selectors/getSearchResults'
import TextOverlay from 'components/TextOverlay/TextOverlay'
import Spinner from 'components/Spinner/Spinner'
import styles from './LibraryView.css'

const LibraryView = () => {
  const { isAdmin } = useAppSelector(state => state.user)
  const { isLoading, filterStr, filterStarred, tab } = useAppSelector(state => state.library)
  const songsResult = useAppSelector(state => state.songs.result)
  const { artistsResult, songsResult: filteredSongsResult } = useAppSelector(getSearchResults)
  const ui = useAppSelector(state => state.ui)

  const isSearching = !!filterStr.trim().length || filterStarred
  const hasNoMatches = isSearching && songsResult.length > 0
    && (tab === 'songs' ? filteredSongsResult.length === 0 : artistsResult.length === 0)
  const [initialHeaderHeight] = useState(ui.headerHeight)
  const [finalHeaderHeight, setFinalHeaderHeight] = useState(null)

  // don't render ArtistList until headerHeight is stable; otherwise
  // scroll position restoration does not work well (appears OBO)
  // @todo - this is hacky
  if (finalHeaderHeight === null && ui.headerHeight > initialHeaderHeight) {
    setFinalHeaderHeight(ui.headerHeight)
  }

  if (!finalHeaderHeight) return null

  return (
    <>
      {tab === 'songs' && <SongResults ui={ui} />}

      {tab === 'artists' && !isSearching && <ArtistList ui={ui} />}

      {tab === 'artists' && isSearching && <SearchResults ui={ui} />}

      {isLoading && <Spinner />}

      {!isLoading && songsResult.length === 0 && (
        <TextOverlay className={styles.empty}>
          <h1>Library Empty</h1>
          {isAdmin && (
            <p>
              <Link to='/settings'>Add media folders</Link>
              {' '}
              to get started.
            </p>
          )}
        </TextOverlay>
      )}

      {!isLoading && hasNoMatches && (
        <TextOverlay className={styles.empty}>
          <h1>No match</h1>
          <p>
            {filterStr.trim()
              ? `Nothing matches “${filterStr.trim()}”. Check the spelling, or try the artist’s name.`
              : 'No starred songs yet. Tap a ★ to keep one here.'}
          </p>
        </TextOverlay>
      )}
    </>
  )
}

export default LibraryView
