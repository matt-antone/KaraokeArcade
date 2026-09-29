import React from 'react'
import clsx from 'clsx'
import { questionMeta, useTriviaClock } from './triviaClock'
import { TRIVIA_ROUND_MIX, triviaPoints, type TriviaRound } from 'shared/types'
import styles from './TriviaRail.css'

/** What each question in a round is worth, in the order they are asked: the
 *  round climbs easy to hard, so the pips read as a ladder. */
const PIPS = TRIVIA_ROUND_MIX.flatMap(level => Array<number>(level.count).fill(level.points))

/** The ladder: asked, this one (lit, glowing), still to come. */
export const TriviaPips = ({ round }: { round: TriviaRound }) => (
  <div className={styles.pips}>
    {PIPS.slice(0, round.questionCount).map((value, i) => (
      <span
        key={i}
        className={clsx(styles.pip, i < round.questionNumber - 1 && styles.asked, i === round.questionNumber - 1 && styles.now)}
      >
        {value}
      </span>
    ))}
  </div>
)

interface TriviaRailProps {
  round: TriviaRound
  /** Answering has closed: the clock gives way to "Answer". */
  isAnswer?: boolean
}

/**
 * The TV's header for a question (12b) and its reveal (12c): the ladder on
 * the left, "Q4 · Medium" and the question's worth in the middle, the clock —
 * or, once it has run out, "Answer" — on the right.
 */
const TriviaRail = ({ round, isAnswer }: TriviaRailProps) => {
  const { clock, secondsLeft } = useTriviaClock(round)

  return (
    <div className={styles.header}>
      <TriviaPips round={round} />
      <div className={styles.where}>
        <span className={styles.meta}>{questionMeta(round)}</span>
        {/* keyed so the burst replays for each question, and again at its reveal */}
        <span key={`${round.roundId}:${isAnswer ? 'answer' : 'ask'}`} className={styles.value}>
          {triviaPoints(round.difficulty)}
        </span>
      </div>
      {isAnswer
        ? <span className={styles.answer}>Answer</span>
        : <span className={styles.clock} role='timer' aria-label={`${secondsLeft} seconds left`}>{clock}</span>}
    </div>
  )
}

export default TriviaRail
