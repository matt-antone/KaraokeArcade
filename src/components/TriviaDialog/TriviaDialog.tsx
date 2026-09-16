import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import AnswerKey, { type AnswerKeyState } from 'components/AnswerKey/AnswerKey'
import Modal from 'components/Modal/Modal'
import TriviaPodium from 'components/TriviaPodium/TriviaPodium'
import TriviaRail from 'components/TriviaRail/TriviaRail'
import TriviaTally from 'components/TriviaTally/TriviaTally'
import alertCue from 'lib/alertCue'
import serverNow from 'lib/serverNow'
import useNow from 'lib/useNow'
import useTriviaStage from 'lib/useTriviaStage'
import { answerTrivia } from 'store/modules/trivia'
import type { TriviaScore } from 'shared/types'
import styles from './TriviaDialog.css'

/**
 * The answer pad, on a phone.
 *
 * It carries the whole round: the question, the four answers, and the clock.
 * Nobody has to look up at the TV to play — which matters most for the guest
 * at the microphone, the one in the next room, and anyone who cannot read a
 * screen across a bar. The TV is where the round happens together; the pad is
 * where it stays playable.
 *
 * It fills the phone: the keys are the whole point, and a 2 × 2 grid that
 * grows with the screen is a bigger target than one sized for a card.
 */
/** Rows that fit under the podium without scrolling — fourth and fifth. The
 *  TV carries the rest of the list. */
const SCOREBOARD_ROWS = 5

/** What one answer key is, which depends entirely on whether the reveal has
 *  landed: before it, the keys are open or your choice is locked in; after it,
 *  they are the correct one, the one you missed, or neither. */
const stateOf = (i: number, correctIdx: number | undefined, answeredIdx: number | null): AnswerKeyState => {
  if (correctIdx !== undefined) {
    if (i === correctIdx) return 'correct'

    return i === answeredIdx ? 'missed' : 'wrong'
  }

  if (answeredIdx === null) return 'open'

  return i === answeredIdx ? 'chosen' : 'closed'
}

/** Fourth and fifth under the podium, and your own row after them if you are
 *  further down. A board you cannot find yourself on is a board you stop
 *  playing for, and outside the top five is where most of the room stands. */
const scoreboardRows = (scores: TriviaScore[], userId: number | null) => {
  const rows = scores.slice(3, SCOREBOARD_ROWS).map((score, i) => ({ score, rank: i + 3, isAside: false }))
  const myRank = scores.findIndex(s => s.userId === userId)

  if (myRank >= SCOREBOARD_ROWS) {
    rows.push({ score: scores[myRank], rank: myRank, isAside: true })
  }

  return rows
}

const TriviaDialog = () => {
  const dispatch = useAppDispatch()
  const { round, result } = useTriviaStage()
  const answeredIdx = useAppSelector(state => state.trivia.answeredIdx)
  const userId = useAppSelector(state => state.user.userId)
  const tick = useNow()
  const [dismissedRoundId, setDismissedRoundId] = useState<number | null>(null)

  const isOpen = !!round && dismissedRoundId !== round.roundId

  // the pad arriving is the only notice a guest gets, and it arrives on a
  // phone that is face down as often as not
  useEffect(() => {
    if (isOpen) alertCue()
  }, [isOpen])

  if (!round || !isOpen) return null

  // The beat after the answer takes the pad's place rather than sitting under
  // it: the keys are dead during the reveal anyway, and a phone has room for
  // one thing. The pad runs the player's beats, off the player's stamps.
  const now = result ? serverNow(result, tick) : 0
  const isTally = !!result && now >= result.scoresFrom
  const isScoreboard = !!result?.boardFrom && now >= result.boardFrom
  const onClose = () => setDismissedRoundId(round.roundId)

  // The same count the TV shows, on every question including the last.
  if (isTally && !isScoreboard) {
    return (
      <Modal className={styles.modal} title='Who got it' onClose={onClose}>
        <div className={clsx(styles.pad, styles.centered)}>
          <TriviaTally numCorrect={result.numCorrect} variant='pad' />
        </div>
      </Modal>
    )
  }

  if (isScoreboard) {
    const rows = scoreboardRows(result.scores, userId)

    return (
      <Modal className={styles.modal} title='Scores' onClose={onClose}>
        <div className={styles.pad}>
          <TriviaRail round={round} meta={`after Q${round.questionNumber}`} variant='pad' />
          {result.scores.length > 0
            ? (
                <>
                  <TriviaPodium scores={result.scores} variant='pad' />
                  <div className={styles.scoreboard}>
                    {rows.map(({ score: s, rank, isAside }) => (
                      <div
                        key={s.userId}
                        className={clsx(
                          styles.scoreRow,
                          s.userId === userId && styles.mine,
                          isAside && styles.aside,
                        )}
                      >
                        <span className={styles.rank}>{String(rank + 1).padStart(2, '0')}</span>
                        <span className={styles.scoreName} translate='no'>{s.name}</span>
                        <span className={styles.score}>{s.score}</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            : <div className={styles.hint}>Nobody played</div>}
        </div>
      </Modal>
    )
  }

  const isMissed = !!result && answeredIdx !== null && answeredIdx !== result.correctIdx

  return (
    <Modal
      className={clsx(styles.modal, result && styles.reveal)}
      title={result ? 'Answer' : 'Trivia'}
      onClose={onClose}
    >
      <div className={styles.pad}>
        {/* The same clock the TV counts down, so the pad and the room run one. */}
        <TriviaRail round={round} isRunning={!result} variant='pad' />

        <div className={styles.question} translate='no'>{round.question}</div>

        <div className={styles.keys}>
          {round.answers.map((answer, i) => (
            <AnswerKey
              key={answer}
              index={i}
              label={answer}
              variant='pad'
              state={stateOf(i, result?.correctIdx, answeredIdx)}
              // one answer each, and the reveal is not a chance to change it
              disabled={answeredIdx !== null || !!result}
              onClick={() => dispatch(answerTrivia(round.roundId, i))}
            />
          ))}
        </div>

        {result
          ? (
              <div className={clsx(styles.hint, isMissed && styles.missed)}>
                {answeredIdx === null
                  ? 'the lit key was the answer'
                  : isMissed ? `you picked ${round.answers[answeredIdx]}` : 'you got it'}
              </div>
            )
          : answeredIdx !== null
            ? <div className={styles.locked}>locked in</div>
            : <div className={styles.hint}>tap your answer</div>}
      </div>
    </Modal>
  )
}

export default TriviaDialog
