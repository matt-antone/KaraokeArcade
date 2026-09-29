/** Whether an account has been shown how scoring works, on this phone.
 *  localStorage keyed by userId; storage that refuses (private mode) just
 *  means it shows again, which is harmless. */

const seenKey = (userId: number) => `scoringSeen:${userId}`

export const hasSeenScoring = (userId: number | null): boolean => {
  if (userId === null) return true
  try {
    return localStorage.getItem(seenKey(userId)) === '1'
  } catch {
    return false
  }
}

export const markScoringSeen = (userId: number | null) => {
  if (userId === null) return
  try {
    localStorage.setItem(seenKey(userId), '1')
  } catch {
    // not remembered; it shows once more next time, nothing worse
  }
}
