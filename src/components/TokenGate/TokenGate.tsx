import React, { useRef, useState } from 'react'
import clsx from 'clsx'
import Hud from 'components/Header/Hud/Hud'
import { rememberInserted } from './tokenInserted'
import styles from './TokenGate.css'

/**
 * Insert token: the cabinet's slide-to-unlock, in front of sign-in.
 *
 * Cosmetic by decision. There are no credits, nothing is validated and
 * nothing goes to the server — it is the arcade's way of saying "tap in", and
 * the only thing it guards is the join screen behind it. The unlock is
 * remembered for the tab's session so a refused password, which remounts the
 * sign-in view, does not send somebody back to the slot.
 *
 * Dragged, the token has to be let go over the slot; anywhere else it springs
 * home. From a keyboard or a screen reader the token is a button that goes in
 * on activation. A pointer tap does nothing on purpose — the drag is the game.
 */

/** Served by koa-static off the assets dir, relative so it follows <base href>. */
const TOKEN = 'assets/arcade/token.svg'
const SLOT = 'assets/arcade/slot-plate.svg'
const LOGO = 'assets/arcade/logo.svg'

/** How long after the drop the gate lifts: the 320ms fall, then "Token
 *  accepted" held long enough to read. */
const INSERT_MS = 1200

const prefersReducedMotion = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches

interface TokenGateProps {
  /** The room's name for the HUD, when the link named one. */
  room?: string
  onUnlock: () => void
}

const TokenGate = ({ room, onUnlock }: TokenGateProps) => {
  const tokenRef = useRef<HTMLButtonElement>(null)
  const slotRef = useRef<HTMLImageElement>(null)
  const grab = useRef<{ x: number, y: number } | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isOver, setIsOver] = useState(false)
  const [isInserted, setIsInserted] = useState(false)

  /** The token's centre over the slot plate, and how far it is from the mouth,
   *  which sits right of the plate's centre and a little above its middle. */
  const hit = () => {
    const t = tokenRef.current?.getBoundingClientRect()
    const s = slotRef.current?.getBoundingClientRect()
    if (!t || !s) return null

    const cx = t.left + t.width / 2
    const cy = t.top + t.height / 2

    return {
      isOver: cx > s.left && cx < s.right && cy > s.top && cy < s.bottom,
      dx: s.left + s.width * 0.55 - cx,
      dy: s.top + s.height * 0.47 - cy,
    }
  }

  const insert = (to = { x: 0, y: 0 }) => {
    if (isInserted) return
    setIsInserted(true)
    setIsOver(false)
    setOffset(to)
    rememberInserted()
    setTimeout(onUnlock, prefersReducedMotion() ? 0 : INSERT_MS)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (isInserted) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    grab.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
    setIsDragging(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!grab.current) return
    setOffset({ x: e.clientX - grab.current.x, y: e.clientY - grab.current.y })
    setIsOver(!!hit()?.isOver)
  }

  const handlePointerUp = () => {
    if (!grab.current) return
    grab.current = null
    setIsDragging(false)

    const h = hit()
    if (h?.isOver) {
      insert({ x: offset.x + h.dx, y: offset.y + h.dy })
      return
    }

    // not in the slot: home it goes, on the CSS spring
    setIsOver(false)
    setOffset({ x: 0, y: 0 })
  }

  // detail 0 is a click no pointer made: Enter, Space, or a screen reader's
  // activate. A real tap is ignored; the token has to be dragged in.
  const handleClick = (e: React.MouseEvent) => {
    if (e.detail === 0) insert()
  }

  return (
    <div className={styles.screen}>
      <Hud room={room} />
      <img className={styles.logo} src={LOGO} alt='KaraokeArcade' />

      <div className={styles.table}>
        <div className={styles.slot}>
          <img
            ref={slotRef}
            className={clsx(styles.plate, isOver && styles.plateHot)}
            src={SLOT}
            alt='Token slot'
            draggable={false}
          />
          <span className={styles.caption}>1 token · 1 singer</span>
        </div>

        <button
          ref={tokenRef}
          type='button'
          aria-label='Insert token'
          className={clsx(styles.token, isDragging && styles.dragging, isInserted && styles.inserted)}
          style={{ '--dx': `${offset.x}px`, '--dy': `${offset.y}px` } as React.CSSProperties}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleClick}
        >
          <img src={TOKEN} alt='' draggable={false} />
        </button>
      </div>

      <div className={styles.prompt} aria-live='polite'>
        {isInserted
          ? <span className={styles.accepted}>Credit accepted</span>
          : (
              <>
                <span className={styles.insert}>Insert token</span>
                <span className={styles.helper}>Drag the token into the slot</span>
              </>
            )}
      </div>
    </div>
  )
}

export default TokenGate
