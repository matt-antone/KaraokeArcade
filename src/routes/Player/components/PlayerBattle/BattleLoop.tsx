import React from 'react'
import clsx from 'clsx'
import { spriteCellBackground, type SpriteCell } from 'lib/battleSingers'
import styles from './PlayerBattle.css'

interface BattleLoopProps {
  /** Already resolved to a frame or a single pose: this draws a cell and knows
   *  nothing about loops, so a static key-art beat and a running loop are the
   *  same element and land in the same place. */
  src: SpriteCell
  /** Which way this fighter is looking. All eight fighters are drawn facing
   *  left, so `right` is the one that costs a flip. */
  facing: 'left' | 'right'
  className?: string
}

/**
 * A fighter on the stage: one element showing one cell of one sheet.
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
 * The inner element is one frame, for the reason given on BattleSprite. Here
 * it is fitted inside the box rather than cropped by it, which is what the
 * stage's beats expect of a sprite that has to share the frame with a plate.
 */
const BattleLoop = ({ src, facing, className }: BattleLoopProps) => (
  <div
    className={clsx(styles.sprite, facing === 'right' && styles.spriteFlip, className)}
    aria-hidden
  >
    <div className={styles.spriteFrame} style={spriteCellBackground(src)} />
  </div>
)

export default BattleLoop
