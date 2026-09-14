import { AnyAction, createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import {
  CLEAR_ERROR_MESSAGE,
  FOOTER_HEIGHT_CHANGE,
  HEADER_HEIGHT_CHANGE,
  SHOW_ERROR_MESSAGE,
  UI_SET_QUEUE_TAB,
  UI_WINDOW_RESIZE,
} from 'shared/actionTypes'
import type { RootState } from 'store/store'

const MAX_CONTENT_WIDTH = 768
let scrollLockTimer: ReturnType<typeof setTimeout> | null

// iOS overlays the software keyboard on the layout viewport instead of shrinking
// it: window.innerHeight doesn't change and no resize event fires, so the
// virtualized lists and the fixed bottom nav stay sized for a viewport the
// keyboard is covering. visualViewport reports the space actually left over and
// does fire resize. Width stays on the layout viewport, since visualViewport's
// width tracks pinch-zoom rather than anything the layout should follow.
export const getViewportSize = () => ({
  innerWidth: window.innerWidth,
  // fractional CSS pixels here would churn the lists on every subpixel change
  innerHeight: Math.round(window.visualViewport?.height ?? window.innerHeight),
})

// ------------------------------------
// Actions
// ------------------------------------
export const clearErrorMessage = createAction(CLEAR_ERROR_MESSAGE)
export const showErrorMessage = createAction<string>(SHOW_ERROR_MESSAGE)
export const setQueueTab = createAction<QueueTab>(UI_SET_QUEUE_TAB)

export const setHeaderHeight = createAsyncThunk<void, number, { state: RootState }>('ui/SET_HEADER_HEIGHT', async (height: number, { dispatch, getState }) => {
  if (getState().ui.headerHeight === height) return
  dispatch({
    type: HEADER_HEIGHT_CHANGE,
    payload: height ?? 0, // height might be undefined if Header renders nothing
  })
})

export const setFooterHeight = createAsyncThunk<void, number, { state: RootState }>('ui/SET_HEADER_HEIGHT', async (height: number, { dispatch, getState }) => {
  if (getState().ui.footerHeight === height) return
  dispatch({
    type: FOOTER_HEIGHT_CHANGE,
    payload: height ?? 0, // height might be undefined if Header renders nothing
  })
})

export const windowResize = createAction(UI_WINDOW_RESIZE, window => ({
  payload: window,
  meta: {
    throttle: {
      wait: 200,
      leading: false,
    },
  },
}))

// does not dispatch anything (only affects the DOM)
export const lockScrolling = (lock: boolean) => {
  if (lock) {
    clearTimeout(scrollLockTimer)
    scrollLockTimer = null
    document.body.classList.add('scroll-lock')
  } else if (!scrollLockTimer) {
    scrollLockTimer = setTimeout(() => {
      scrollLockTimer = null
      document.body.classList.remove('scroll-lock')
    }, 200)
  }
}
const footerHeightChange = createAction<number>(FOOTER_HEIGHT_CHANGE)
const headerHeightChange = createAction<number>(HEADER_HEIGHT_CHANGE)

// ------------------------------------
// Reducer
// ------------------------------------
export type QueueTab = 'queue' | 'me' | 'history'

export interface UIState {
  isErrored: boolean
  errorMessage: string | null
  footerHeight: number
  headerHeight: number
  innerWidth: number
  innerHeight: number
  contentWidth: number
  queueTab: QueueTab
}

const initialState: UIState = {
  isErrored: false,
  errorMessage: null,
  footerHeight: 0,
  headerHeight: 0,
  ...getViewportSize(),
  contentWidth: Math.min(window.innerWidth, MAX_CONTENT_WIDTH),
  queueTab: 'queue',
}

const uiReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(headerHeightChange, (state, { payload }) => {
      state.headerHeight = payload
    })
    .addCase(footerHeightChange, (state, { payload }) => {
      state.footerHeight = payload
    })
    .addCase(showErrorMessage, (state, { payload }) => {
      state.isErrored = true
      state.errorMessage = payload
    })
    .addCase(setQueueTab, (state, { payload }) => {
      state.queueTab = payload
    })
    .addCase(clearErrorMessage, (state) => {
      state.isErrored = false
    })
    .addCase(windowResize, (state, { payload }) => {
      state.innerWidth = payload.innerWidth
      state.innerHeight = payload.innerHeight
      state.contentWidth = Math.min(payload.innerWidth, MAX_CONTENT_WIDTH)
    })
    .addMatcher(
      (action): action is AnyAction => !!action.error,
      (state, { error }) => {
        state.isErrored = true
        state.errorMessage = error.message ?? error
      },
    )
})

export default uiReducer
