import React from 'react'
import clsx from 'clsx'
import type { Iris } from './useBattleIris'
import styles from './BattleFrame.css'

/**
 * The cabinet both phones in a battle are looking at.
 *
 * The challenger's setup and the opponent's invite are the same machine seen
 * from two sides, so the accent strip, the header, the CRT wash and the iris
 * are one component rather than two that agree today. The only thing that
 * varies is which side is holding the phone, which is one prop: the local
 * player is always gold-or-their-own-tint and the header says which player
 * they are.
 *
 * The scanline wash and the vignette are the last children and take no
 * pointer events, so they sit over the whole screen — including the iris —
 * without eating a tap meant for the key underneath.
 */

interface BattleFrameProps {
  /** Which side of the negotiation is holding this phone. */
  variant: 'setup' | 'invite'
  /** The one line in Michroma under PLAYER n. Fixed on setup; the invite
   *  renames itself per step, which is the only progress cue it has. */
  title: string
  /** One entry per step, true for the ones already behind. */
  pips: boolean[]
  iris: Iris
  frameRef: React.RefObject<HTMLDivElement | null>
  /** Omitted when there is no step behind this one — the `‹` key is not drawn
   *  disabled, it is not drawn at all. */
  onBack?: (e: React.MouseEvent<HTMLButtonElement>) => void
  /** The invite has none on purpose: declining is a decision, not a
   *  dismissal, and a CANCEL in the corner is how somebody answers a
   *  challenge without meaning to. */
  onCancel?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
  /** Drawn above the wash and the iris. The flying singer lives here: it has
   *  to cross the whole frame, so it cannot be inside the screen it is
   *  leaving. */
  overlay?: React.ReactNode
}

const BattleFrame = ({
  variant, title, pips, iris, frameRef, onBack, onCancel, children, overlay,
}: BattleFrameProps) => (
  <div
    ref={frameRef}
    className={clsx(styles.screen, variant === 'invite' && styles.two)}
    style={{ '--fx-x': iris.x, '--fx-y': iris.y } as React.CSSProperties}
  >
    <div className={styles.accent} />

    <div className={styles.header}>
      {onBack && (
        <button type='button' className={styles.back} onClick={onBack} aria-label='Back'>
          &#8249;
        </button>
      )}

      <div className={clsx(styles.headerText, !onBack && styles.headerTextInset)}>
        <div className={styles.eyebrow}>{variant === 'setup' ? 'PLAYER 1' : 'PLAYER 2'}</div>
        <div className={styles.wordmark}>{title}</div>
      </div>

      <div className={styles.pips}>
        {pips.map((isDone, i) => (
          <div key={i} className={clsx(styles.pip, isDone && styles.pipDone)} />
        ))}
      </div>

      {onCancel && (
        <button type='button' className={styles.cancel} onClick={onCancel}>CANCEL</button>
      )}
    </div>

    {children}

    {/* Over everything, touchable through: the wash and the vignette sit on all
        four battle screens so the room is looking at one cabinet from four
        places. */}
    <div className={styles.scanlines} />
    <div className={styles.vignette} />

    {iris.isBursting && (
      <div className={styles.fx} key={iris.n}>
        <div className={styles.iris} style={{ backgroundColor: iris.tone }} />
        <div className={styles.ring} style={{ borderColor: iris.tone }} />
      </div>
    )}

    {overlay}
  </div>
)

export default BattleFrame
