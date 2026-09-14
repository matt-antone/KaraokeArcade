/**
 * Who this phone sang as last time.
 *
 * On the handset rather than on the account, because it is a convenience of
 * the device: what it seeds is the selection the grid opens on, which is what
 * makes NEXT live the moment the screen arrives rather than a key waiting for
 * somebody to do something first. A browser that refuses storage just opens on
 * the first playable singer instead, and nothing else changes.
 *
 * Both phones read it and only the one that committed to a battle writes it —
 * a singer somebody looked at and backed out of is not who they sang as.
 */

const KEY = 'battleSingerId'

export const readLastBattleSinger = (): string | null => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const writeLastBattleSinger = (id: string) => {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // a locked-down browser is allowed to refuse and nothing here depends on it
  }
}
