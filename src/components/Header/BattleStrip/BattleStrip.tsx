import React from 'react'
import clsx from 'clsx'
import useBattleStage, { sideOfPhase } from 'lib/useBattleStage'
import { formatDuration } from 'lib/dateTime'
import type { BattleSide, BattleTurn } from 'shared/types'
import styles from './BattleStrip.css'

/**
 * A battle in progress, on a phone.
 *
 * Five minutes of one queue row is two songs of everybody else's waiting, and
 * until this existed the phones said nothing at all for the whole of it — the
 * queue showed a row that was somehow still current and the header showed a
 * wait that had stopped moving. The television has the spectacle; this is the
 * caption under it.
 *
 * Deliberately not the ten-beat splash the TV draws, and deliberately not a
 * modal: the arcade language is illegible at this size, and a panel that owns
 * the phone for five minutes is worse than showing nothing. One row in the
 * chrome, in the deck's own language, saying the one thing the room cannot
 * work out by looking — how long is left — and the two things it can, so that
 * somebody glancing down knows what they are hearing.
 *
 * The same strip for everyone, fighters included. A fighter is holding a
 * microphone, not a phone, and a view built for the person least able to look
 * at it is a view nobody reads.
 */

const nameOf = (turn: BattleTurn, side: BattleSide) =>
  (side === 1 ? turn.challengerName : turn.opponentName)

/** What the strip says, per beat. The legend is silkscreen, the line is the
 *  sentence, and everything else on the row is a readout. */
const caption = (turn: BattleTurn, side: BattleSide | null): { legend: string, line: string } => {
  switch (turn.phase) {
    /* The title card names nobody on the television, and this row is not the
       television: a phone that lights up mid-song is being told which fight is
       starting, and "Starting now" over two names it cannot see is a strip that
       has stopped saying anything. */
    case 'logo':
    case 'versus':
      return { legend: 'singer battle', line: `${turn.challengerName} vs ${turn.opponentName}` }
    case 'intro1':
    case 'intro2': {
      const at = side ?? 1
      return { legend: 'up next', line: nameOf(turn, at) }
    }
    case 'sing1':
    case 'sing2': {
      const at = side ?? 1
      const song = at === 1 ? turn.challengerSong : turn.opponentSong
      return { legend: 'singing', line: `${nameOf(turn, at)} — ${song.title}` }
    }
    case 'judge':
      return { legend: 'singer battle', line: 'The room decides' }
    case 'meter1':
    case 'meter2':
      return { legend: 'cheer for', line: nameOf(turn, side ?? 1) }
    case 'winner':
      return {
        legend: 'result',
        line: turn.challengerScore === turn.opponentScore
          ? 'Draw'
          : `${nameOf(turn, turn.challengerScore > turn.opponentScore ? 1 : 2)} wins`,
      }
  }
}

const BattleStrip = () => {
  const { turn, phase, msLeft } = useBattleStage()

  if (!turn || !phase) return null

  const side = sideOfPhase(phase)
  const { legend, line } = caption(turn, side)

  // Grades are only a fact once there is something to grade: before the first
  // metering beat they are both 0, and a row reading "0 — 0" through the two
  // songs looks like a fight nobody is winning rather than one not yet judged.
  const isScored = phase === 'meter1' || phase === 'meter2' || phase === 'winner'
  const isSinging = phase === 'sing1' || phase === 'sing2'

  return (
    <div
      className={clsx(
        styles.container,
        side === 1 && styles.sideOne,
        side === 2 && styles.sideTwo,
      )}
    >
      {/* The channel colour is a rule, never the type: --ans-1-hi as text on a
          faceplate measures 2.7:1, which is the reason BattleDialog draws its
          two sides the same way. */}
      <div className={styles.text}>
        <div className={clsx('silkscreen', styles.legend)}>{legend}</div>
        <div className={styles.line} translate='no'>{line}</div>
      </div>

      {isScored && (
        <div className={styles.scores} translate='no'>
          {turn.challengerScore}
          {' — '}
          {turn.opponentScore}
        </div>
      )}

      {isSinging && <div className={styles.clock}>{formatDuration(Math.ceil(msLeft / 1000))}</div>}
    </div>
  )
}

export default BattleStrip
