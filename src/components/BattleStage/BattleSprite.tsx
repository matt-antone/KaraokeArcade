import React from 'react'
import clsx from 'clsx'
import { spriteCellBackground, type SpriteCell } from 'lib/battleSingers'
import styles from './BattleSprite.css'

/**
 * A fighter, drawn to fill whatever it is standing in.
 *
 * One declaration paints a 46px chip, a 116px versus plate and a whole roster
 * tile, which is why it is a background-image and not an `<img>`: the art is a
 * standing figure, and fitting one inside a box leaves the box mostly floor.
 * Anchored to the bottom and scaled past the box so the feet land on the
 * bottom edge and the sides crop, at any size.
 *
 * The crop and the frame selection are two different jobs, so they are two
 * elements. The outer one is the box and clips; the inner one is exactly one
 * frame, which is what lets the sheet be sized in whole multiples of itself
 * and the frame picked with a plain percentage. Doing both on one element
 * would need a background-position that depends on the box's width, which has
 * no closed form in CSS.
 */

interface BattleSpriteProps {
  /** Null for a roster slot whose art has not been drawn — nothing is
   *  rendered, and the caller draws the locked glyph instead. */
  art: SpriteCell | null
  /** Facing the other fighter. Only the left half of a versus pairing is
   *  flipped; a phone chip is never. */
  isFlipped?: boolean
  className?: string
}

const BattleSprite = ({ art, isFlipped, className }: BattleSpriteProps) => (art
  ? (
      <span className={clsx(styles.sprite, isFlipped && styles.flipped, className)}>
        <span className={styles.frame} style={spriteCellBackground(art)} />
      </span>
    )
  : null)

export default BattleSprite
