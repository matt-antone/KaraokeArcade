import React, { useEffect } from 'react'
import { Navigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { fetchPrefs } from 'store/modules/prefs'
import FirstRun from './FirstRun/FirstRun'
import SignedInView from './SignedInView/SignedInView'
import SignedOutView from './SignedOutView/SignedOutView'
import styles from './AccountView.css'

interface AccountViewProps {
  /**
   * Rendered at '/', the app's one login route: shows first-run or sign-in,
   * and hands off to the app once there is a session. Without it this is the
   * signed-in account screen at '/account', which RequireAuth guards.
   */
  isSignInRoute?: boolean
}

const AccountView = ({ isSignInRoute }: AccountViewProps) => {
  const isSignedIn = useAppSelector(state => state.user.userId !== null)
  const isFirstRun = useAppSelector(state => state.prefs.isFirstRun === true)
  const dispatch = useAppDispatch()

  // once per mount
  // (do this here instead of Prefs component to detect firstRun)
  useEffect(() => {
    dispatch(fetchPrefs())
  }, [dispatch])

  // signed in with nothing to set up, there is nothing to ask for — go to the
  // app, preserving search params (a roomId deep link, say)
  if (isSignInRoute && isSignedIn && !isFirstRun) {
    return <Navigate to={{ pathname: '/library', search: window.location.search }} replace />
  }

  if (isFirstRun) return <div className={styles.column}><FirstRun /></div>

  // 02 Join as draws its own full-screen shell
  if (isSignInRoute) return <SignedOutView />

  return isSignedIn ? <div className={styles.container}><SignedInView /></div> : null
}

export default AccountView
