/** The token gate's memory: once in, it stays in for the tab's session, so a
 *  refused password does not send somebody back to the slot. */

const SESSION_KEY = 'tokenInserted'

/** Whether this tab already put its token in. Storage can be refused
 *  (private mode, a locked-down webview): then the gate just shows again. */
export const isTokenInserted = (): boolean => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export const rememberInserted = () => {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // not remembered; the slot asks again next mount, which is harmless
  }
}

/** Leaving the room goes back to the slot (08c › Leave room → 01). */
export const forgetInserted = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // nothing was remembered either
  }
}
