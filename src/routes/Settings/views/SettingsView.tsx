import React, { useEffect } from 'react'
import combinedReducer from 'store/reducers'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { fetchPrefs } from 'store/modules/prefs'
import usersReducer, { sliceInjectNoOp } from '../modules/users'
import Prefs from '../components/Prefs/Prefs'
import Player from '../components/Player/Player'
import Rooms from '../components/Rooms/Rooms'
import Users from '../components/Users/Users'
import styles from './SettingsView.css'

const SettingsView = () => {
  const sliceExists = !!useAppSelector(state => state.users)
  const dispatch = useAppDispatch()

  if (!sliceExists) {
    combinedReducer.inject({ reducerPath: 'users', reducer: usersReducer })
    dispatch(sliceInjectNoOp()) // update store with new slice
  }

  // once per mount
  useEffect(() => {
    dispatch(fetchPrefs())
  }, [dispatch])

  return (
    <div className={styles.container}>
      {/* 09's order: the room, who is in it, the machine playing it, the media */}
      <Rooms />
      <Users />
      <Player />
      <Prefs />
    </div>
  )
}

export default SettingsView
