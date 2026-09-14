import React from 'react'
import clsx from 'clsx'
import styles from './PlayerBattle.css'

interface BattleLoopProps {
  /** Already resolved to a frame or a single pose: this draws a URL and knows
   *  nothing about loops, so a static key-art beat and a running loop are the
   *  same element and land in the same place. */
  src: string
  /** Which way this fighter is looking. All eight fighters are drawn facing
   *  left, so `right` is the one that costs a flip. */
  facing: 'left' | 'right'
  className?: string
}

/**
 * A fighter on the stage: one element, one background image, swapped per frame.
 *
 * Deliberately not four stacked <img> cross-fading on opacity, which is what
 * the design prototype does and what the handoff explicitly rules out. Two
 * reasons it matters here rather than being a style preference: compositing
 * sixteen 512px layers every frame is real work on the Pi-class box a player
 * often is and it has a karaoke video to decode at the same time, and a
 * cross-fade between two drawings of the same body puts semi-transparent pixels
 * through art that is hard alpha everywhere else — the fighter goes soft at the
 * edges for half of every frame.
 */
const BattleLoop = ({ src, facing, className }: BattleLoopProps) => (
  <div
    className={clsx(styles.sprite, facing === 'right' && styles.spriteFlip, className)}
    style={{ backgroundImage: `url('${src}')` }}
    aria-hidden
  />
)

export default BattleLoop
