import React from 'react'
import clsx from 'clsx'
import type { TriviaScore } from 'shared/types'
import styles from './TriviaPodium.css'

/** Left to right: second, first, third — first stands in the middle, tallest. */
const PLACES = [1, 0, 2]

interface TriviaPodiumProps {
  /** Best first; only the top three are drawn. */
  scores: TriviaScore[]
  /** 'player' is sized for a room, 'pad' for a hand. */
  variant: 'player' | 'pad'
}

/**
 * The top three, on blocks. Same bargain as TriviaTally: one component, both
 * surfaces, and the variant only changes scale.
 */
const TriviaPodium = ({ scores, variant }: TriviaPodiumProps) => (
  <div className={clsx(styles.podium, styles[variant])}>
    {PLACES.filter(place => scores[place]).map(place => (
      <div key={scores[place].userId} className={clsx(styles.column, styles[`p${place}`])}>
        <div className={styles.name} translate='no'>{scores[place].name}</div>
        <div className={styles.score}>{scores[place].score}</div>
        <div className={styles.block}>{place + 1}</div>
      </div>
    ))}
  </div>
)

export default TriviaPodium
