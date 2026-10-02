import { combineSlices } from '@reduxjs/toolkit'
import { optimistic } from 'redux-optimistic-ui'

import artists from 'routes/Library/modules/artists'
import battle from './modules/battle'
import library from 'routes/Library/modules/library'
import party from './modules/party'
import points from './modules/points'
import prefs from './modules/prefs'
import queue from 'routes/Queue/modules/queue'
import rooms from './modules/rooms'
import songs from 'routes/Library/modules/songs'
import starCounts from 'routes/Library/modules/starCounts'
import status from './modules/status'
import trivia from './modules/trivia'
import ui from './modules/ui'
import user from './modules/user'
import userStars from './modules/userStars'

export interface LazyLoadedSlices {} // eslint-disable-line @typescript-eslint/no-empty-object-type

const combinedReducer = combineSlices({
  artists,
  // eager rather than lazy-loaded: the phone needs it to negotiate a challenge
  // and the player needs it to run one, so there is no route that can own it
  battle,
  library,
  points,
  party,
  prefs,
  queue: optimistic(queue),
  rooms,
  songs,
  starCounts,
  status,
  trivia,
  ui,
  user,
  userStars: optimistic(userStars),
}).withLazyLoadedSlices<LazyLoadedSlices>()

export default combinedReducer
