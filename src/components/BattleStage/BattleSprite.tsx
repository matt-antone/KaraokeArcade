import React from 'react'
import clsx from 'clsx'
import { battleSingerPortrait, type RosterSinger } from 'lib/battleSingers'
import styles from './BattleSprite.css'

/**
 * A fighter on a phone: their head, fitted to whatever it is standing in.
 *
 * Phones draw portraits and never key art. A phone is held at arm's length in
 * a dark room and a chip on it is 46px square; a standing figure at that size
 * is a silhouette with a face three pixels across, and the same figure in a
 * hero slot is mostly boots. The head crop is the one cut that reads at every
 * size a phone asks for, so there is one component and it draws that.
 *
 * The full figures and the animated sheets belong to the TV, which has the
 * room to show a fighter standing up — see BattleLoop.
 */

interface BattleSpriteProps {
  singer: RosterSinger
  /** Facing the other fighter. Only the left half of a versus pairing is
   *  flipped; a phone chip is never. */
  isFlipped?: boolean
  className?: string
}

const BattleSprite = ({ singer, isFlipped, className }: BattleSpriteProps) => (
  <img
    className={clsx(styles.sprite, isFlipped && styles.flipped, className)}
    src={battleSingerPortrait(singer, 80)}
    alt=''
  />
)

export default BattleSprite
