import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppSelector } from 'store/hooks'
import clsx from 'clsx'
import { CSSTransition } from 'react-transition-group'
import { QRCode } from 'react-qrcode-logo'
import type { QueueItem, IRoomPrefs } from 'shared/types'
import styles from './PlayerQR.css'

const MIN_STATIC_MS = 10000 // 10 sec
const MAX_STATIC_MS = 180000 // 3 min

interface PlayerQRProps {
  height: number
  prefs: IRoomPrefs['qr']
  queueItem: QueueItem
  /** Sat in the idle screen's join panel rather than parked in a corner. */
  isDocked?: boolean
}

// the value --ink resolves to. The code is painted to a canvas, so it needs a
// real colour rather than the token; keep the two in step.
const INK = '#e9e2ff'

const PlayerQR = ({ height, prefs, queueItem, isDocked }: PlayerQRProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const maxTimerID = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastToggleTime = useRef<number>(0)
  const [show, setShow] = useState(true)
  const { isPlaying } = useAppSelector(state => state.player)
  const { roomId } = useAppSelector(state => state.user)
  const serverUrl = useAppSelector(state => state.prefs.serverUrl)

  const scheduleNextToggle = useCallback(() => {
    if (maxTimerID.current) {
      clearTimeout(maxTimerID.current)
      maxTimerID.current = null
    }

    // wait for current song to end?
    if (isPlaying) return

    const now = Date.now()
    const timeSinceLastToggle = now - lastToggleTime.current
    const timeUntilMax = Math.max(MAX_STATIC_MS - timeSinceLastToggle, 0)

    maxTimerID.current = setTimeout(() => {
      setShow(false)
    }, timeUntilMax)
  }, [isPlaying])

  useEffect(() => {
    lastToggleTime.current = Date.now()
  }, [])

  useEffect(() => {
    scheduleNextToggle()

    return () => {
      if (maxTimerID.current) clearTimeout(maxTimerID.current)
    }
  }, [scheduleNextToggle])

  useEffect(() => {
    const now = Date.now()
    const timeSinceLastToggle = now - lastToggleTime.current

    if (timeSinceLastToggle > MIN_STATIC_MS) {
      const timeout = setTimeout(() => setShow(false), 0)
      return () => clearTimeout(timeout)
    }
  }, [queueItem?.queueId])

  const handleTransitionEnd = () => {
    if (!show) {
      setShow(true) // trigger enter transition
      lastToggleTime.current = Date.now()

      scheduleNextToggle()
    }
  }

  // Build from the server's own LAN address, not this browser's. A host who
  // opened the player at localhost would otherwise encode localhost, and every
  // phone that scanned the code would be pointed at itself. Falls back to our
  // own location when the server reports no external IPv4.
  const url = new URL(serverUrl ?? window.location.href)
  url.pathname = url.pathname.replace(/\/player$/, '')
  url.searchParams.append('roomId', String(roomId))

  if (prefs.password) {
    url.searchParams.append('password', btoa(prefs.password))
  }

  // docked, it is the panel's centrepiece at the design's size; parked, the room's pref sizes it
  const size = Math.round(height * (isDocked ? 0.28 : 0.05 + (prefs.size ?? 0.5) / 5)) // min: 5vh, max: 25vh
  const quietZoneSize = 5 + (10 * (prefs.size ?? 0.5)) // min: 5px, max: 15px

  return (
    <CSSTransition
      in={show}
      nodeRef={ref}
      classNames={{
        enterActive: styles.enterActive,
        exitActive: styles.exitActive,
      }}
      addEndListener={(done: () => void) => {
        const node = ref.current
        if (!node) return

        const onTransitionEnd = (e: Event) => {
          if (e.target !== node) return // ignore bubbling from children
          node.removeEventListener('transitionend', onTransitionEnd)
          done() // required for react-transition-group
          handleTransitionEnd()
        }

        node.addEventListener('transitionend', onTransitionEnd, false)
      }}
    >
      <div
        className={clsx(styles.container, isDocked && styles.docked)}
        ref={ref}
      >
        <QRCode
          value={url.href}
          ecLevel='L'
          size={size}
          quietZone={quietZoneSize}
          style={{ opacity: prefs.opacity ?? 1 }}
          bgColor={INK}
          qrStyle='dots'
        />
      </div>
    </CSSTransition>
  )
}

export default PlayerQR
