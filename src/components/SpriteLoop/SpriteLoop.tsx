import React from 'react'
import clsx from 'clsx'
import useSpriteFrame from 'lib/useSpriteFrame'
import {
  spriteCellBackground,
  type BattleSingerLoop,
  type RosterSinger,
  type SpriteCell,
} from 'lib/battleSingers'
import styles from './SpriteLoop.css'

interface SpriteBoxProps {
  /** Already resolved to a frame or a single pose: this draws a cell and knows
   *  nothing about loops, so a static key-art beat and a running loop are the
   *  same element and land in the same place. */
  src: SpriteCell
  /** Which way this fighter is looking. All fighters are drawn facing left,
   *  so `right` is the one that costs a flip. */
  facing: 'left' | 'right'
  className?: string
  style?: React.CSSProperties
}

/**
 * A fighter: one element showing one cell of one sheet.
 *
 * Deliberately not four stacked <img> cross-fading on opacity, which is what
 * the design prototype does and what the handoff explicitly rules out. Two
 * reasons it matters here rather than being a style preference: compositing
 * sixteen 480px layers every frame is real work on the Pi-class box a player
 * often is and it has a karaoke video to decode at the same time, and a
 * cross-fade between two drawings of the same body puts semi-transparent pixels
 * through art that is hard alpha everywhere else — the fighter goes soft at the
 * edges for half of every frame.
 *
 * The inner element is one frame, fitted inside the box rather than cropped by
 * it. The box is absolute: the caller places it (and, without `size`, sizes it)
 * with a className.
 */
export const SpriteBox = ({ src, facing, className, style }: SpriteBoxProps) => (
  <div
    className={clsx(styles.sprite, facing === 'right' && styles.spriteFlip, className)}
    style={style}
    aria-hidden
  >
    <div className={styles.spriteFrame} style={spriteCellBackground(src)} />
  </div>
)

interface SpriteLoopProps {
  singer: RosterSinger
  loop: BattleSingerLoop
  /** The square box the design draws the sheet at: '330px', '107.4vh'. */
  size: string
  facing: 'left' | 'right'
  /** One-shot sets (ko, victory) only: how far into the animation the room
   *  is, live. Without it a one-shot holds its last frame. See useSpriteFrame. */
  elapsedMs?: number
  className?: string
}

/** A fighter playing one of their sheets, on the wall clock (useSpriteFrame). */
const SpriteLoop = ({ singer, loop, size, facing, elapsedMs, className }: SpriteLoopProps) => {
  const frame = useSpriteFrame(singer, loop, elapsedMs)

  return (
    <SpriteBox
      src={frame}
      facing={facing}
      className={className}
      style={{ width: size, height: size }}
    />
  )
}

export default SpriteLoop
