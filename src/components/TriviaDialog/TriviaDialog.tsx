import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import AnswerKey, { type AnswerKeyState } from 'components/AnswerKey/AnswerKey'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import TriviaPodium from 'components/TriviaPodium/TriviaPodium'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import TriviaRail from 'components/TriviaRail/TriviaRail'
import TriviaTally from 'components/TriviaTally/TriviaTally'
import alertCue from 'lib/alertCue'
import { battleSingerKeyArt, battleSingerOrDefault, battleSingerStage } from 'lib/battleSingers'
import serverNow from 'lib/serverNow'
import useNow from 'lib/useNow'
import useTriviaStage from 'lib/useTriviaStage'
import { answerTrivia } from 'store/modules/trivia'
import { triviaPoints, type TriviaScore } from 'shared/types'
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
 * It fills the phone: the keys are the whole point, stacked full width at
 * the bottom where a thumb already is.
 */
/** Rows that fit under the podium without scrolling — fourth and fifth. The
 *  TV carries the rest of the list. */
const SCOREBOARD_ROWS = 5

/** What one answer key is while answering is open: all takeable, or your
 *  choice locked in and the other three gone dark. The reveal draws its own
 *  keys. */
const stateOf = (i: number, answeredIdx: number | null): AnswerKeyState => {
  if (answeredIdx === null) return 'open'

  return i === answeredIdx ? 'chosen' : 'closed'
}

const PLACE = new Intl.PluralRules('en', { type: 'ordinal' })
const SUFFIX: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' }

/** 1st, 2nd, 3rd, 4th — a standing reads as a place, not an index. */
const ordinal = (n: number) => `${n}${SUFFIX[PLACE.select(n)]}`

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
  const navigate = useNavigate()
  const { round, result } = useTriviaStage()
  const answeredIdx = useAppSelector(state => state.trivia.answeredIdx)
  const userId = useAppSelector(state => state.user.userId)
  const avatarId = useAppSelector(state => state.user.avatarId)
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
    const myRank = result.scores.findIndex(s => s.userId === userId)

    return (
      <Modal className={styles.modal} title='Scores' onClose={onClose}>
        <div className={styles.pad}>
          <TriviaRail round={round} meta={`after Q${round.questionNumber}`} variant='pad' />
          {myRank !== -1 && (
            <div className={styles.verdict}>
              <span className={clsx(styles.headline, styles.final)}>
                {myRank === 0 ? 'You win' : `${ordinal(myRank + 1)} place`}
              </span>
              <span className={styles.points}>{`${result.scores[myRank].score} pts`}</span>
            </div>
          )}
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
                        <UserAvatar className={styles.scoreAvatar} avatarId={s.avatarId} />
                        <span className={styles.scoreName} translate='no'>{s.name}</span>
                        <span className={styles.score}>{s.score}</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            : <div className={styles.hint}>Nobody played</div>}
          <div className={styles.spacer} />
          <Button
            variant='primary'
            onClick={() => {
              onClose()
              navigate('/library')
            }}
          >
            Back to songs
          </Button>
        </div>
      </Modal>
    )
  }

  // The reveal is its own screen on the phone: the verdict, what it was worth,
  // your pick beside the answer, and where that leaves you. The other keys are
  // noise by now.
  if (result) {
    const isRight = answeredIdx === result.correctIdx
    const myRank = result.scores.findIndex(s => s.userId === userId)
    const singer = battleSingerOrDefault(avatarId)

    return (
      <Modal className={styles.modal} title='Answer' onClose={onClose}>
        <div className={clsx(styles.pad, styles.reveal)}>
          <div className={styles.verdict}>
            {answeredIdx === null
              ? (
                  <>
                    <span className={clsx(styles.headline, styles.timeUp)}>{'Time\'s up'}</span>
                    <span className={styles.note}>No answer · +0</span>
                  </>
                )
              : (
                  <>
                    <span className={clsx(styles.headline, isRight ? styles.right : styles.wrong)}>
                      {isRight ? 'Correct' : 'Wrong'}
                    </span>
                    <span className={clsx(styles.points, !isRight && styles.nil)}>
                      {isRight ? `+${triviaPoints(round.difficulty)}` : '+0'}
                    </span>
                  </>
                )}
          </div>

          <div className={styles.keys}>
            {answeredIdx !== null && !isRight && (
              <AnswerKey index={answeredIdx} label={round.answers[answeredIdx]} variant='pad' state='missed' tag='your pick' disabled />
            )}
            <AnswerKey
              index={result.correctIdx}
              label={round.answers[result.correctIdx]}
              variant='pad'
              state='correct'
              tag={isRight ? 'your pick' : 'answer'}
              disabled
            />
          </div>

          {/* your character, on their own stage */}
          <div
            className={styles.art}
            style={{
              '--key': `url('${battleSingerKeyArt(singer).url}')`,
              '--stage': `url('${battleSingerStage(singer)}')`,
            } as React.CSSProperties}
          />

          {myRank !== -1 && (
            <div className={styles.standing}>
              <span className={styles.caption}>Trivia standing</span>
              <span className={styles.standingValue}>{`${ordinal(myRank + 1)} · ${result.scores[myRank].score}`}</span>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal className={styles.modal} title='Trivia' onClose={onClose}>
      <div className={styles.pad}>
        {/* The same clock the TV counts down, so the pad and the room run one. */}
        <TriviaRail round={round} isRunning variant='pad' />

        <div className={styles.question} translate='no'>{round.question}</div>

        <div className={styles.spacer} />

        <div className={styles.keys}>
          {round.answers.map((answer, i) => (
            <AnswerKey
              key={answer}
              index={i}
              label={answer}
              variant='pad'
              state={stateOf(i, answeredIdx)}
              // one answer each
              disabled={answeredIdx !== null}
              onClick={() => dispatch(answerTrivia(round.roundId, i))}
            />
          ))}
        </div>

        {answeredIdx !== null
          ? <div className={styles.locked}>locked in</div>
          : <div className={styles.hint}>tap your answer</div>}
      </div>
    </Modal>
  )
}

export default TriviaDialog
