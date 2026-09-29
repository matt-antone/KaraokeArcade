import React from 'react'
import { useAppSelector } from 'store/hooks'
import { QRCode } from 'react-qrcode-logo'
import type { IRoomPrefs } from 'shared/types'
import styles from './PlayerQR.css'

interface PlayerQRProps {
  height: number
  /** Only the password is read: a locked room's code carries it. */
  prefs?: IRoomPrefs['qr']
}

// the value --ink resolves to. The code is painted to a canvas, so it needs a
// real colour rather than the token; keep the two in step.
const INK = '#e9e2ff'

/**
 * 10 · the join code, in the idle screen's join column: 150 of the design's
 * 540, on a flat 8px ring of its own plate colour that doubles as the quiet
 * zone. Always there on the join screen and never moves (U-22).
 */
const PlayerQR = ({ height, prefs }: PlayerQRProps) => {
  const { roomId } = useAppSelector(state => state.user)
  const serverUrl = useAppSelector(state => state.prefs.serverUrl)

  // Build from the server's own LAN address, not this browser's. A host who
  // opened the player at localhost would otherwise encode localhost, and every
  // phone that scanned the code would be pointed at itself. Falls back to our
  // own location when the server reports no external IPv4.
  const url = new URL(serverUrl ?? window.location.href)
  url.pathname = url.pathname.replace(/\/player$/, '')
  url.searchParams.append('roomId', String(roomId))

  if (prefs?.password) {
    url.searchParams.append('password', btoa(prefs.password))
  }

  return (
    <div className={styles.container}>
      <QRCode
        value={url.href}
        ecLevel='L'
        size={Math.round(height * 150 / 540)}
        quietZone={0}
        bgColor={INK}
      />
    </div>
  )
}

export default PlayerQR
