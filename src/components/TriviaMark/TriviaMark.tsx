import React, { useEffect, useRef } from 'react'
import clsx from 'clsx'
import createTriviaSting from 'lib/triviaSting'
import styles from './TriviaMark.css'

interface TriviaMarkProps {
  /** 'stage' fills its parent and plays once on mount — the card that covers
   *  the gap before a round arrives. 'glyph' is the resting mark alone, sized
   *  by the caller, and never animates. */
  variant: 'stage' | 'glyph'
  /** A spent round: the mark goes to --ink-5, the way .spent dims a row. */
  isDim?: boolean
  className?: string
}

/**
 * The trivia mark, wherever it appears. One component for the same reason
 * AnswerKey is one: the card on the TV and the glyph in a queue row are the
 * same four registers, and the still is the card's last frame rather than a
 * second drawing of it.
 *
 * The canvas is drawn by lib/triviaSting; this is only its mount, its size and
 * its lifetime.
 */
const TriviaMark = ({ variant, isDim, className }: TriviaMarkProps) => {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return

    const isGlyph = variant === 'glyph'
    const sting = createTriviaSting(ref.current, { glyph: isGlyph, isDim })

    // Silkscreen has to be resident before the nameplate is drawn, or the word
    // comes out in the fallback and re-lays out when the face lands.
    if (!isGlyph) {
      document.fonts.load('400 40px Silkscreen')
        .then(() => sting.play())
        .catch(() => sting.play())
    }

    return () => sting.destroy()
  }, [variant, isDim])

  return (
    <canvas
      ref={ref}
      className={clsx(styles[variant], className)}
      role='img'
      aria-label='Trivia'
    />
  )
}

export default TriviaMark
