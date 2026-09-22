import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router'
import { useAppSelector } from 'store/hooks'
import { AvatarGate } from 'components/BattleStage/AvatarPicker'

import AccountView from 'routes/Account/views/AccountView'
import LibraryView from 'routes/Library/views/LibraryView'
import QueueView from 'routes/Queue/views/QueueView'
import SettingsView from 'routes/Settings/views/SettingsView'

const PlayerView = React.lazy(() => import('routes/Player/views/PlayerView'))
const Preview = React.lazy(() => import('./Preview'))

const AppRoutes = () => (
  <Routes>
    <Route
      path='/account'
      element={(
        <RequireAuth path='/account' redirectTo='/'>
          <AccountView />
        </RequireAuth>
      )}
    />
    <Route
      path='/settings'
      element={(
        <RequireAuth path='/settings' redirectTo='/'>
          <SettingsView />
        </RequireAuth>
      )}
    />
    <Route
      path='/library'
      element={(
        <RequireAuth path='/library' redirectTo='/'>
          <LibraryView />
        </RequireAuth>
      )}
    />
    <Route
      path='/queue'
      element={(
        <RequireAuth path='/queue' redirectTo='/'>
          <QueueView />
        </RequireAuth>
      )}
    />
    <Route
      path='/player'
      element={(
        <RequireAuth path='/player' redirectTo='/'>
          <PlayerView />
        </RequireAuth>
      )}
    />
    {/* TEMPORARY screenshot harness — delete this route, Preview.tsx, and
        'preview' from the index-route list in server/serverWorker.ts together,
        once the README art is captured. Unguarded on purpose: every scene is
        built from the fixtures the tests use, so it reads nothing from the
        room and there is nothing here to require an account for. */}
    <Route path='/preview' element={<PreviewScene />} />
    {/* The only way in. Signing out, an expired session and a deep link to a
        guarded route all land here, so there is exactly one place that asks
        for credentials. Once signed in it hands off to the app. */}
    <Route path='/' element={<AccountView isSignInRoute />} />
  </Routes>
)

export default AppRoutes

/** Scene, width and height all come off the query string. A path segment
 *  would read better but the dev and production servers both hand the SPA
 *  index to a fixed list of single-segment paths, so /preview/<scene> is a
 *  404 before React sees it. */
const PreviewScene = () => {
  const scene = new URLSearchParams(useLocation().search).get('scene') ?? ''

  return <Preview scene={scene} />
}

interface RequireAuthProps {
  children: React.ReactNode
  path: string
  redirectTo: string
}

/** Exported for its own tests: every route in the table goes through it, and
 *  standing a real view up behind it to ask one question about the gate tests
 *  the view instead. */
export const RequireAuth = ({
  children,
  path,
  redirectTo,
}: RequireAuthProps) => {
  const { avatarId, isAdmin, userId } = useAppSelector(state => state.user)
  const location = useLocation()

  // signed out: sign in first (checked before the admin-only paths below so
  // the desired location isn't lost on the way to the sign-in view)
  if (userId === null) {
    // set their originally-desired location in query parameter
    const params = new URLSearchParams(location.search)
    params.set('redirect', path)

    return <Navigate to={redirectTo + '?' + params.toString()} replace />
  }

  if ((path === '/player' || path === '/settings') && !isAdmin) {
    return <Navigate to='/' replace />
  }

  // Signed in with nobody to be yet: ask, once, before anything else renders.
  // Here rather than in the app shell because this is already the app's one
  // "you can't be here yet" seam, and because it is the only place that knows
  // which path is being entered -- which /player needs it to.
  //
  // Falsy rather than === null: this slice is persisted, so a store rehydrated
  // from before the column shipped has no key here at all and reads undefined.
  //
  // /player is exempt and must stay exempt. It is the television: a signed-in
  // admin route that nothing backfills an avatarId for, so a gate without this
  // line puts a character picker on the TV on first boot after 020. Anything
  // added to this list is a screen that has to work for somebody who has not
  // picked yet.
  if (!avatarId && path !== '/player') {
    return <AvatarGate />
  }

  return children
}
