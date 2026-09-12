import React from 'react'
import clsx from 'clsx'
import styles from './BattleSprite.css'

/**
 * A fighter, drawn to fill whatever it is standing in.
 *
 * One declaration paints a 46px chip, a 116px versus plate and a whole roster
 * tile, which is why it is a background-image and not an `<img>`: the art is a
 * standing figure, and fitting one inside a box leaves the box mostly floor.
 * Anchored to the bottom and scaled past the box so the feet land on the
 * bottom edge and the sides crop, at any size.
 */

interface BattleSpriteProps {
  /** Null for a roster slot whose art has not been drawn — nothing is
   *  rendered, and the caller draws the locked glyph instead. */
  art: string | null
  /** Facing the other fighter. Only the left half of a versus pairing is
   *  flipped; a phone chip is never. */
  isFlipped?: boolean
  className?: string
}

const BattleSprite = ({ art, isFlipped, className }: BattleSpriteProps) => (art
  ? (
      <span
        className={clsx(styles.sprite, isFlipped && styles.flipped, className)}
        style={{ backgroundImage: `url('${art}')` }}
      />
    )
  : null)

export default BattleSprite
