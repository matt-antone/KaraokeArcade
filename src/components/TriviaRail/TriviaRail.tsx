import React from 'react'
import clsx from 'clsx'
import serverNow from 'lib/serverNow'
import useNow from 'lib/useNow'
import type { TriviaRound } from 'shared/types'
import styles from './TriviaRail.css'

/** Segments in the time bar: a room reads eight, a hand six. */
const SEGMENTS = { player: 8, pad: 6 }

interface TriviaRailProps {
  round: TriviaRound
  /** The screen's wordmark — 'trivia', 'answer', 'who got it'. */
  label?: string
  /** Wordmark colour. Yellow is the default; mint marks the answer. */
  tone?: 'yellow' | 'mint'
  /** Replaces "Q4 / 10" — the standings read "after Q4". */
  meta?: string
  /** False once answering has closed: the clock and the bar go, because there
   *  is nothing left to be in time for. */
  isRunning?: boolean
  /** The countdown's last stretch, on the TV: LOCK IT IN, one big cell. */
  isUrgent?: boolean
  /** 'player' is sized for a room, 'pad' for a hand. */
  variant: 'player' | 'pad'
}

/**
 * The header a round is read by: what this beat is, how far through the round,
 * and how long is left. One component because the TV and every phone in the
 * room count the same round down, and a pad that says 4 while the screen says
 * 6 is worse than a pad with no clock at all.
 *
 * The TV's clock is an LED readout: two cells with the unlit 8 ghosting behind
 * each digit, swelling to one big cell for the last five seconds. The phone
 * does not escalate — only the room does.
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
  const digits = String(Math.min(99, secondsLeft)).padStart(2, '0')

  return (
    <>
      <div className={clsx(styles.header, styles[variant], isUrgent && styles.urgent)}>
        {label && (
          <div className={clsx(styles.wordmark, styles[tone])}>
            {isUrgent ? 'lock it in' : label}
          </div>
        )}
        <div className={styles.spacer} />
        <div className={styles.meta}>
          {meta ?? (variant === 'player'
            ? `Q${round.questionNumber} / ${round.questionCount}`
            : `Q${round.questionNumber}/${round.questionCount}`)}
        </div>
        {isRunning && variant === 'pad' && <div className={styles.padClock}>{digits}</div>}
        {isRunning && variant === 'player' && (
          <div className={styles.clock} role='timer' aria-label={`${secondsLeft} seconds left`}>
            {(isUrgent ? digits.slice(1) : digits).split('').map((d, i) => (
              <div key={i} className={styles.cell}>
                <span className={styles.ghost} aria-hidden='true'>8</span>
                <span className={styles.digit}>{d}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Steps rather than drains, like a segment meter: redrawn by the same
          tick the numerals ride. The leading lit segment blinks. */}
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
