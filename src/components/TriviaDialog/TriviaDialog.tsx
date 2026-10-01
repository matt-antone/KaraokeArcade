import React, { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import AnswerKey, { type AnswerKeyState } from 'components/AnswerKey/AnswerKey'
import Button from 'components/Button/Button'
import Hud from 'components/Header/Hud/Hud'
import Modal from 'components/Modal/Modal'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import { TriviaPips } from 'components/TriviaRail/TriviaRail'
import { questionMeta, useTriviaClock } from 'components/TriviaRail/triviaClock'
import TriviaTally from 'components/TriviaTally/TriviaTally'
import alertCue from 'lib/alertCue'
import { BATTLE_STAGE_PLATE, battleSingerKeyArt, battleSingerOrDefault, battleSingerStage } from 'lib/battleSingers'
import { ordinal } from 'lib/ordinal'
import serverNow from 'lib/serverNow'
import useNow from 'lib/useNow'
import useTriviaStage from 'lib/useTriviaStage'
import { answerTrivia } from 'store/modules/trivia'
import { myStanding } from 'store/selectors/points'
import {
  TRIVIA_FINAL_REST_MS,
  TRIVIA_QUESTIONS_PER_ROUND,
  TRIVIA_ROUND_MIX,
  triviaPoints,
  type TriviaResult,
  type TriviaRound,
} from 'shared/types'
import styles from './TriviaDialog.css'

/** What a whole round is worth to someone who gets every question. */
const ROUND_POOL = TRIVIA_ROUND_MIX.reduce((n, level) => n + level.count * level.points, 0)

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** What one answer key is while answering is open: all takeable, or your
 *  choice locked in and the other three faded back. */
const stateOf = (i: number, answeredIdx: number | null): AnswerKeyState => {
  if (answeredIdx === null) return 'open'

  return i === answeredIdx ? 'chosen' : 'closed'
}

/** Your own character standing on your own stage, washed down to the ground
 *  (the design's location at .55). 12f draws the figure alone. */
const Art = ({ avatarId, height, isLocated, className, children }: {
  avatarId: string | null | undefined
  /** The key art's drawn height: 500 on 12f, 420 on 12f2/12f3, 560 on 12g. */
  height: number
  isLocated: boolean
  className?: string
  children?: React.ReactNode
}) => {
  const singer = battleSingerOrDefault(avatarId)

  return (
    <div
      className={clsx(styles.art, isLocated && styles.located, className)}
      style={isLocated
        ? { '--stage': `url('${battleSingerStage(singer)}'), url('${BATTLE_STAGE_PLATE}')` } as React.CSSProperties
        : undefined}
    >
      <img className={styles.keyArt} src={battleSingerKeyArt(singer).url} alt='' style={{ height }} />
      {children}
    </div>
  )
}

/** The pad arrives with the question and goes with its reveal; the final
 *  rests until it is put away. One of these per screen the pad can show. */
type Screen = { kind: 'leadIn', key: string, endsAt: number }
  | { kind: 'round', key: string, round: TriviaRound, result: TriviaResult | null }

/**
 * The answer pad, on a phone.
 *
 * It carries the whole round: the question, the four answers, and the clock.
 * Nobody has to look up at the TV to play — which matters most for the guest
 * at the microphone, the one in the next room, and anyone who cannot read a
 * screen across a bar. The TV is where the round happens together; the pad is
 * where it stays playable.
 *
 * Each beat is a full screen (12e0 → 12e → 12f* → the count → 12g), with the
 * keys stacked full width at the bottom where a thumb already is.
 */
const TriviaDialog = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const live = useTriviaStage()
  const stored = useAppSelector(state => state.trivia)
  const answeredIdx = stored.answeredIdx
  const userId = useAppSelector(state => state.user.userId)
  const avatarId = useAppSelector(state => state.user.avatarId)
  const venue = useAppSelector(state => (
    state.user.roomId === null ? undefined : state.rooms.entities[state.user.roomId]?.name
  ))
  const singerCount = useAppSelector(state => state.rooms.singerCount)
  const leadInEndsAt = useAppSelector(state => state.status.leadInEndsAt)
  const leadInQueueId = useAppSelector(state => state.status.leadInQueueId)
  // The lead-in's end comes by the TV's clock, rebased by the server onto its
  // own and stamped, so it is read through serverNow like every other
  // deadline. One stamp object per status, so each is measured once, on arrival.
  const leadInSentAt = useAppSelector(state => (state.status.leadInEndsAt === undefined ? undefined : state.status.sentAt))
  const leadInStamp = useMemo(() => (leadInSentAt === undefined ? undefined : { sentAt: leadInSentAt }), [leadInSentAt])
  const night = useAppSelector(myStanding)
  const tick = useNow()
  const leadInNow = leadInStamp ? serverNow(leadInStamp, tick) : tick
  const [dismissed, setDismissed] = useState<string | null>(null)

  // The live round first; then the TV counting a round in; then a finished
  // round's final, which rests until it is put away rather than expiring.
  const isResting = !!stored.round && !!stored.result?.isFinal && stored.result.roundId === stored.round.roundId
  let screen: Screen | null = null

  if (live.round) {
    screen = { kind: 'round', key: `q${live.round.roundId}`, round: live.round, result: live.result }
  } else if (leadInEndsAt !== undefined) {
    screen = { kind: 'leadIn', key: `lead${leadInQueueId}`, endsAt: leadInEndsAt }
  } else if (isResting) {
    screen = { kind: 'round', key: `q${stored.round!.roundId}`, round: stored.round!, result: stored.result }
  }

  const isOpen = !!screen && screen.key !== dismissed

  // the pad arriving is the only notice a guest gets, and it arrives on a
  // phone that is face down as often as not
  useEffect(() => {
    if (isOpen) alertCue()
  }, [isOpen])

  // The final board rests "until it is put away" — but nobody puts it away on
  // a phone nobody is holding, and this screen is a native <dialog> that sits
  // over everything else regardless of z-index (see TRIVIA_FINAL_REST_MS).
  // Left open, it blocks whatever this phone is asked for next. Read through
  // the same tick every other deadline on this screen uses, not Date.now()
  // directly, so this stays a pure function of render.
  const finalResult = isOpen && screen && screen.kind === 'round' && screen.result?.isFinal ? screen.result : null
  const finalKey = finalResult ? screen!.key : null
  const finalBoardFrom = finalResult?.boardFrom ?? null

  useEffect(() => {
    if (!finalKey || !finalResult || finalBoardFrom === null) return

    const remaining = finalBoardFrom + TRIVIA_FINAL_REST_MS - serverNow(finalResult, tick)
    const timerID = setTimeout(() => setDismissed(finalKey), Math.max(0, remaining))
    return () => clearTimeout(timerID)
  }, [finalKey, finalResult, finalBoardFrom, tick])

  if (!screen || !isOpen) return null

  const { key } = screen
  const onClose = () => setDismissed(key)
  const hud = (right: React.ReactNode) => (
    <Hud left={<span className={styles.yellow}>Trivia</span>} room={venue} right={right} />
  )

  // 12e0 · the TV is counting the round in
  if (screen.kind === 'leadIn') {
    return (
      <Modal className={styles.modal} variant='screen' title='Trivia' onClose={onClose}>
        <div className={styles.screen}>
          {hud(<span className={styles.mint}>Get ready</span>)}
          <div className={styles.waiting}>
            <span className={styles.title}>TRIVIA</span>
            <span className={styles.startsIn}>Starts in</span>
            <span className={styles.countdown}>{mmss(Math.max(0, Math.ceil((screen.endsAt - leadInNow) / 1000)))}</span>
            <span className={styles.blurb}>
              {`${TRIVIA_QUESTIONS_PER_ROUND} questions · ${ROUND_POOL} pts up for grabs. Watch the TV, answer here.`}
            </span>
            <span className={styles.players}>{`${singerCount} ${singerCount === 1 ? 'player' : 'players'} in`}</span>
          </div>
        </div>
      </Modal>
    )
  }

  const { round, result } = screen

  if (!result) {
    return (
      <Modal className={styles.modal} variant='screen' title='Trivia' onClose={onClose}>
        <TriviaQuestion
          hud={hud}
          round={round}
          answeredIdx={answeredIdx}
          onAnswer={i => dispatch(answerTrivia(round.roundId, i))}
        />
      </Modal>
    )
  }

  // The pad runs the player's beats, off the player's stamps: the answer,
  // then how many got it, and after the last question the final.
  const now = serverNow(result, tick)
  const isTally = now >= result.scoresFrom
  const isBoard = !!result.boardFrom && now >= result.boardFrom

  // 12g / 12g2 · the round's result, from where you stand
  if (isBoard) {
    const mine = result.standings.find(s => s.userId === userId)
    const rank = mine ? 1 + result.standings.filter(s => s.points > mine.points).length : null
    const winner = result.standings[0]

    return (
      <Modal className={styles.modal} variant='screen' title='Final' onClose={onClose}>
        <div className={styles.screen}>
          {hud(<span className={styles.yellow}>Final</span>)}
          <Art avatarId={avatarId} height={560} isLocated className={styles.finalArt}>
            <div className={styles.overlay}>
              {rank !== null && (
                <span className={clsx(styles.headline, rank === 1 ? styles.youWin : styles.place)}>
                  {rank === 1 ? 'YOU WIN' : `${ordinal(rank).toUpperCase()} PLACE`}
                </span>
              )}
              <span className={styles.correct}>{`${mine?.numCorrect ?? 0}/${result.questionCount} correct`}</span>
            </div>
          </Art>
          <div className={styles.panel}>
            {winner && rank !== 1 && (
              <div className={styles.winnerCard}>
                <UserAvatar className={styles.winnerAvatar} avatarId={winner.avatarId} />
                <span className={styles.winnerName} translate='no'>{`${winner.name} won`}</span>
                <span className={styles.winnerPoints}>{winner.points}</span>
              </div>
            )}
            <div className={styles.line}>
              <span className={styles.caption}>This round</span>
              <span className={styles.roundPoints}>{`+${mine?.points ?? 0}`}</span>
            </div>
            <div className={styles.line}>
              <span className={styles.caption}>Tonight</span>
              <span className={styles.nightPoints}>{night.points}</span>
            </div>
          </div>
          <div className={styles.footer}>
            <Button
              variant='primary'
              cta
              onClick={() => {
                onClose()
                navigate('/library')
              }}
            >
              Back to songs
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  const qHud = hud(<span className={styles.text2}>{`Q${round.questionNumber}`}</span>)

  // How the room did, on every question: the same count the TV shows.
  if (isTally) {
    return (
      <Modal className={styles.modal} variant='screen' title='Who got it' onClose={onClose}>
        <div className={styles.screen}>
          {qHud}
          <div className={styles.centered}>
            <TriviaTally numCorrect={result.numCorrect} variant='pad' />
          </div>
        </div>
      </Modal>
    )
  }

  // 12f / 12f2 / 12f3 · the verdict, what it was worth, your pick beside the
  // answer, and where the night's trivia leaves you
  const isRight = answeredIdx === result.correctIdx
  const myRank = result.scores.findIndex(s => s.userId === userId)
  // never answered yet (a TIME'S UP on your first): no row, so 0, placed where
  // the server's order would put it — behind every score, ahead of the zeros
  // who answered
  const standing = myRank === -1
    ? `${ordinal(1 + result.scores.filter(s => s.score > 0).length)} · 0`
    : `${ordinal(myRank + 1)} · ${result.scores[myRank].score}`

  return (
    <Modal className={styles.modal} variant='screen' title='Answer' onClose={onClose}>
      <div className={styles.screen}>
        {qHud}
        <div className={styles.verdict}>
          {answeredIdx === null
            ? (
                <>
                  <span className={clsx(styles.headline, styles.timeUp)}>{'TIME\'S UP'}</span>
                  <span className={styles.noAnswer}>No answer · +0</span>
                </>
              )
            : (
                <>
                  <span className={clsx(styles.headline, isRight ? styles.right : styles.wrong)}>
                    {isRight ? 'CORRECT' : 'WRONG'}
                  </span>
                  <span className={clsx(styles.points, !isRight && styles.nil)}>
                    {isRight ? `+${triviaPoints(round.difficulty)}` : '+0'}
                  </span>
                </>
              )}
        </div>

        <div className={styles.cards}>
          {answeredIdx !== null && !isRight && (
            <AnswerKey index={answeredIdx} label={round.answers[answeredIdx]} variant='card' state='missed' tag='Your pick' disabled />
          )}
          <AnswerKey
            index={result.correctIdx}
            label={round.answers[result.correctIdx]}
            variant='card'
            state={isRight ? 'right' : 'correct'}
            tag={isRight ? 'Your pick' : 'Answer'}
            disabled
          />
        </div>

        <Art avatarId={avatarId} height={isRight ? 500 : 420} isLocated={!isRight} />

        <div className={styles.standing}>
          <span className={styles.caption}>Trivia standing</span>
          <span className={styles.standingValue}>{standing}</span>
        </div>
      </div>
    </Modal>
  )
}

/** 12e · the question, the clock draining under it, and the four keys. */
const TriviaQuestion = ({ hud, round, answeredIdx, onAnswer }: {
  hud: (right: React.ReactNode) => React.ReactNode
  round: TriviaRound
  answeredIdx: number | null
  onAnswer: (i: number) => void
}) => {
  // The same clock the TV counts down, so the pad and the room run one.
  const { clock, secondsLeft, fraction } = useTriviaClock(round)

  return (
    <div className={styles.screen}>
      {hud(<span className={styles.clock} role='timer' aria-label={`${secondsLeft} seconds left`}>{clock}</span>)}
      <div className={styles.ladder}>
        <TriviaPips round={round} />
        <span className={styles.worth}>{`${triviaPoints(round.difficulty)} pts`}</span>
      </div>
      <div className={styles.meta}>{questionMeta(round)}</div>
      <div className={styles.question} translate='no'>{round.question}</div>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${fraction * 100}%` }} />
      </div>
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
            onClick={() => onAnswer(i)}
          />
        ))}
        <span className={styles.note}>
          {answeredIdx === null ? 'Tap to lock in · one answer' : 'Locked in · waiting for the room'}
        </span>
      </div>
    </div>
  )
}

export default TriviaDialog
