// This router renders <App/>, which reaches store/modules/user.ts. That module
// needs to navigate after a sign-in carrying a `redirect`, and used to import
// this file back to do it — a cycle through nearly every screen in the app,
// survived only by keeping the import dynamic. It asks lib/navigate now, and
// this is the end that fills it in: the dependency runs one way again.
import React from 'react'
import { createBrowserRouter } from 'react-router'
import App from 'components/App/App'
import { setNavigate } from './navigate'

const basename = new URL(document.baseURI).pathname

const AppRouter = createBrowserRouter([
  // https://github.com/remix-run/react-router/issues/9422#issuecomment-1302564759
  { path: '*', element: <App /> },
], { basename })

setNavigate(to => AppRouter.navigate(to))

export default AppRouter
