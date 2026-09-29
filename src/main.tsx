import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import store from './store/store'
import socket from 'lib/socket'
import AppRouter from 'lib/AppRouter'
import { connectSocket } from './store/modules/user'
import * as Persistor from 'store/Persistor'

Persistor.init(store, () => {
  // rehydration complete; open socket connection
  // if it looks like we have a valid session
  if (store.getState().user.userId !== null) {
    store.dispatch(connectSocket())
    socket.open()
  }
})

// @font-face only fetches a face once something on screen uses it, and the
// bold Silkscreen cut is trivia's alone — nothing uses it until a round is
// already up. Ask for it now so the first title card draws in the right face.
// Best-effort: the fallback stack covers a miss.
document.fonts?.load('700 1em Silkscreen').catch(() => {})

socket.on('reconnect_attempt', () => {
  store.dispatch(connectSocket())
})

// ========================================================
// Go!
// ========================================================
createRoot(document.getElementById('root'))
  .render(
    <React.StrictMode>
      <RouterProvider router={AppRouter} />
    </React.StrictMode>,
  )
