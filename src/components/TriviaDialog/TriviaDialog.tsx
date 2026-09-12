import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import AnswerKey, { type AnswerKeyState } from 'components/AnswerKey/AnswerKey'
import Modal from 'components/Modal/Modal'
import TriviaRail from 'components/TriviaRail/TriviaRail'
import TriviaTally from 'components/TriviaTally/TriviaTally'
import alertCue from 'lib/alertCue'
import serverNow from 'lib/serverNow'
import useNow from 'lib/useNow'
import useTriviaStage from 'lib/useTriviaStage'
import { answerTrivia } from 'store/modules/trivia'
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
 * The keys say what they are rather than which they are. A numeral bridging
 * the pad to the screen bridges nothing once both spell out "Saturn", and the
 * reveal lights the key with the answer written on it.
 *
 * The clock is the same two marks the TV uses: how far through the round you
 * are, and how much of the answering time is left.
 */
/** What fits a phone without scrolling. Everyone else is still on the board;
 *  the TV carries the same list. */
const SCOREBOARD_ROWS = 5

/** A correct answer that was yours, or the one you actually picked and missed.
 *  Every other key is just its own text. */
const labelOf = (answer: string, state: AnswerKeyState, isMine: boolean) => {
  if (state === 'correct' && isMine) return `🎉 ${answer}`
  if (state === 'missed') return `😬 ${answer}`

  return answer
}

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

/** Top five, and your own row after them if you are not in it. A board you
 *  cannot find yourself on is a board you stop playing for, and outside the
 *  top five is exactly where most of the room is standing. */
const scoreboardRows = (scores: TriviaScore[], userId: number | null) => {
  const rows = scores.slice(0, SCOREBOARD_ROWS).map((score, i) => ({ score, rank: i, isAside: false }))
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

  // The same count the TV shows, on every question including the last.
  if (isTally && !isScoreboard) {
    return (
      <Modal
        className={styles.modal}
        title='Who got it'
        onClose={() => setDismissedRoundId(round.roundId)}
      >
        <TriviaTally numCorrect={result.numCorrect} variant='pad' />
      </Modal>
    )
  }

  if (isScoreboard) {
    const rows = scoreboardRows(result.scores, userId)

    return (
      <Modal
        className={styles.modal}
        title='Scores'
        onClose={() => setDismissedRoundId(round.roundId)}
      >
        {rows.length > 0
          ? (
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
            )
          : <div className={styles.hint}>Nobody played</div>}
      </Modal>
    )
  }

  return (
    <Modal
      className={styles.modal}
      title={result ? 'Answer' : 'Trivia'}
      onClose={() => setDismissedRoundId(round.roundId)}
    >
      {/* The same two marks the TV carries, so the pad and the room run one
          clock — and no answer text, so the question stays on the screen. */}
      <TriviaRail round={round} isRunning={!result} variant='pad' />

      <div className={styles.question} translate='no'>{round.question}</div>

      <div className={styles.keys}>
        {round.answers.map((answer, i) => {
          const state = stateOf(i, result?.correctIdx, answeredIdx)

          return (
            <AnswerKey
              key={answer}
              index={i}
              // The two faces the tally already uses, said to one guest about
              // one key: the popper on the answer you got, the grimace on the
              // one you pressed instead. Both ride on your own key, so the pad
              // tells you how you did without you counting keys.
              label={labelOf(answer, state, i === answeredIdx)}
              variant='pad'
              state={state}
              // one answer each, and the reveal is not a chance to change it
              disabled={answeredIdx !== null || !!result}
              onClick={() => dispatch(answerTrivia(round.roundId, i))}
            />
          )
        })}
      </div>
      <div className={styles.hint}>
        {result
          ? 'The lit key was the answer'
          : answeredIdx !== null ? 'Locked in' : 'Tap your answer'}
      </div>
    </Modal>
  )
}

export default TriviaDialog
