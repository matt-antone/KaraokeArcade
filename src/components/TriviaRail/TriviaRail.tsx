import React from 'react'
import clsx from 'clsx'
import serverNow from 'lib/serverNow'
import useNow from 'lib/useNow'
import { TRIVIA_ROUND_MIX, triviaPoints, type TriviaRound } from 'shared/types'
import styles from './TriviaRail.css'

/** Segments in the time bar: a room reads eight, a hand six. */
const SEGMENTS = { player: 8, pad: 6 }

/** What each question in a round is worth, in the order they are asked: the
 *  round climbs easy to hard, so the pips read as a ladder. */
const PIPS = TRIVIA_ROUND_MIX.flatMap(level => Array<number>(level.count).fill(level.points))

interface TriviaRailProps {
  round: TriviaRound
  /** The beat's name — 'trivia', 'answer', 'who got it'. Stands where the
   *  clock stood once answering has closed. */
  label?: string
  /** Label colour. Yellow is the default; mint marks the answer. */
  tone?: 'yellow' | 'mint'
  /** Replaces "Q4 · medium" — the standings read "after Q4". */
  meta?: string
  /** False once answering has closed: the clock and the bar go, because there
   *  is nothing left to be in time for. */
  isRunning?: boolean
  /** The countdown's last stretch, on the TV: LOCK IT IN, and the clock swells. */
  isUrgent?: boolean
  /** 'player' is sized for a room, 'pad' for a hand. */
  variant: 'player' | 'pad'
}

/**
 * The header a round is read by: the ladder of what each question is worth,
 * where this one sits on it, and how long is left. One component because the
 * TV and every phone in the room count the same round down, and a pad that
 * says 4 while the screen says 6 is worse than a pad with no clock at all.
 *
 * The question's value bursts in when the question lands — the one number on
 * the screen worth shouting about. The phone does not escalate at the end;
 * only the room does.
 */
const TriviaRail = ({ round, label, tone = 'yellow', meta, isRunning, isUrgent, variant }: TriviaRailProps) => {
  const now = useNow()
  const left = round.endsAt - serverNow(round, now)
  const secondsLeft = Math.max(0, Math.ceil(left / 1000))
  // `sentAt` is the moment the server opened answering, so the pair of stamps
  // is the whole countdown and the room's chosen duration is never sent.
  const total = Math.max(1, round.endsAt - round.sentAt)
  const segments = SEGMENTS[variant]
  const lit = Math.min(segments, Math.max(0, Math.ceil(left / total * segments)))
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
  const points = triviaPoints(round.difficulty)

  const pips = (
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

  // keyed on the question so the burst replays for each one
  const value = <span key={round.roundId} className={styles.value}>{variant === 'pad' ? `${points} pts` : points}</span>

  const where = meta ?? <span className={styles.difficulty}>{`Q${round.questionNumber} · ${round.difficulty}`}</span>

  const right = isRunning
    ? (
        <div className={styles.clockWrap}>
          {isUrgent && <span className={styles.lock}>lock it in</span>}
          <span className={styles.clock} role='timer' aria-label={`${secondsLeft} seconds left`}>{clock}</span>
        </div>
      )
    : label && <span className={clsx(styles.label, styles[tone])}>{label}</span>

  return (
    <>
      {variant === 'player'
        ? (
            <div className={clsx(styles.header, styles.player, isUrgent && styles.urgent)}>
              {pips}
              <div className={styles.where}>
                <span className={styles.meta}>{where}</span>
                {!meta && value}
              </div>
              {right}
            </div>
          )
        : (
            <div className={clsx(styles.pad, isUrgent && styles.urgent)}>
              <div className={styles.header}>
                {pips}
                {!meta && value}
              </div>
              <div className={styles.header}>
                <span className={styles.meta}>{where}</span>
                {right}
              </div>
            </div>
          )}

      {/* Steps rather than drains, like a segment meter: redrawn by the same
          tick the clock rides. The leading lit segment blinks. */}
      {isRunning && (
        <div className={clsx(styles.timeBar, styles[variant], isUrgent && styles.urgent)}>
          {Array.from({ length: segments }, (_, i) => (
            <div key={i} className={clsx(styles.segment, i < lit && styles.lit, i === lit - 1 && styles.lead)} />
          ))}
        </div>
      )}
    </>
  )
}

export default TriviaRail
