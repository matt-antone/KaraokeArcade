import React from 'react'
import clsx from 'clsx'
import styles from './WordArt.css'

export type WordArtKind = 'wins' | 'gameOver' | 'begin'

/** The design's word art, in assets/battle beside the lockup. */
const ART: Record<WordArtKind, { src: string, alt: string }> = {
  wins: { src: 'assets/battle/word-wins.png', alt: 'Wins' },
  gameOver: { src: 'assets/battle/word-game-over.png', alt: 'Game over' },
  begin: { src: 'assets/battle/word-begin.png', alt: 'Begin' },
}

interface WordArtProps {
  kind: WordArtKind
  /** The drawn width: '360px' on the trivia winner, stage units on battle. */
  width: string
  /** Placement and timing: left/top, z-index, animationDelay. Keyframe
   *  offsets are in design px; a screen drawn in other units sets --wa-u to
   *  one design px in them. */
  style?: React.CSSProperties
  className?: string
}

/**
 * WINS, GAME OVER and BEGIN, each with its own entrance: winsin (a drop with
 * a glow), gameover (slams into the middle, holds, parks small at the top)
 * and beginslam (in from three times its size). GAME OVER places itself in
 * the middle of its positioned parent; the other two sit where they are put.
 */
const WordArt = ({ kind, width, style, className }: WordArtProps) => (
  <img
    className={clsx(styles.art, styles[kind], className)}
    src={ART[kind].src}
    alt={ART[kind].alt}
    style={{ width, ...style }}
  />
)

export default WordArt
