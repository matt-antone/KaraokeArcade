import React from 'react'
import { useNavigate } from 'react-router'
import { useAppSelector } from 'store/hooks'
import ArtistList from '../components/ArtistList/ArtistList'
import SearchResults from '../components/SearchResults/SearchResults'
import SongResults from '../components/SongResults/SongResults'
import getSearchResults from '../selectors/getSearchResults'
import Button from 'components/Button/Button'
import TextOverlay from 'components/TextOverlay/TextOverlay'
import Spinner from 'components/Spinner/Spinner'
import useIsHeaderSettled from './useIsHeaderSettled'
import styles from './LibraryView.css'

const LibraryView = () => {
  const navigate = useNavigate()
  const { isAdmin } = useAppSelector(state => state.user)
  const { isLoading, filterStr, filterStarred, tab } = useAppSelector(state => state.library)
  const songsResult = useAppSelector(state => state.songs.result)
  const { artistsResult, songsResult: filteredSongsResult } = useAppSelector(getSearchResults)
  const ui = useAppSelector(state => state.ui)

  const isSearching = !!filterStr.trim().length || filterStarred
  const hasNoMatches = isSearching && songsResult.length > 0
    && (tab === 'songs' ? filteredSongsResult.length === 0 : artistsResult.length === 0)
  // don't render ArtistList until headerHeight is stable; otherwise
  // scroll position restoration does not work well (appears OBO)
  const isHeaderSettled = useIsHeaderSettled(ui.headerHeight)

  if (!isHeaderSettled) return null

  return (
    <>
      {tab === 'songs' && <SongResults ui={ui} />}

      {tab === 'artists' && !isSearching && <ArtistList ui={ui} />}

      {tab === 'artists' && isSearching && <SearchResults ui={ui} />}

      {/* centred in the space between the tabs and the nav (04c) */}
      <div className={styles.overlay}>
        {isLoading && <Spinner />}

        {!isLoading && songsResult.length === 0 && (
          <TextOverlay className={styles.empty}>
            <h1>Library empty</h1>
            {isAdmin && (
              <>
                <p>Add media folders to get started.</p>
                <Button variant='primary' cta onClick={() => navigate('/settings')}>
                  Add media folders
                </Button>
              </>
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
      </div>
    </>
  )
}

export default LibraryView
