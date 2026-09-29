import React, { useState } from 'react'
import clsx from 'clsx'
import { useAppSelector } from 'store/hooks'
import BattleFrame from 'components/BattleStage/BattleFrame'
import BattleKey from 'components/BattleStage/BattleKey'
import SpriteLoop from 'components/SpriteLoop/SpriteLoop'
import { formatDuration } from 'lib/dateTime'
import {
  BATTLE_STAGE_PLATE,
  battleSingerKeyArt,
  battleSingerStage,
  type RosterSinger,
} from 'lib/battleSingers'
import { myStanding } from 'store/selectors/points'
import { BATTLE_SING_MS, POINTS_BATTLE_TAKE_PART, POINTS_BATTLE_WIN } from 'shared/types'
import type { BattleSide, BattleTurn } from 'shared/types'
import { sideOf } from './battleSide'
import styles from './BattleFighter.css'

/**
 * The two fighters' phones, and the verdict every phone in the room shares.
 * Arcade Flow v2 2d:
 *
 *   13e / 13e2  singing now: YOU'RE ON, your song, your fighter in your room
 *   13j         the result on the winner's phone: YOU WIN
 *   13j2        the result on the loser's phone: K.O., and a rematch
 *   13j3        the result for everyone who watched (BattleResult, from
 *               BattleVote)
 */

/** A fighter's own room. Most ship no location.png, so the 404 is the
 *  ordinary path to the dive bar. */
export const Location = ({ singer, className }: { singer: RosterSinger, className: string }) => {
  const [isMissing, setIsMissing] = useState(false)
  const src = battleSingerStage(singer)

  return (
    <img
      key={src}
      className={clsx(styles.location, className)}
      src={isMissing ? BATTLE_STAGE_PLATE : src}
      alt=''
      onError={() => setIsMissing(true)}
    />
  )
}

/** Ten cells in the side's colour, `lit` of them on. */
export const HpGrid = ({ lit, side, className }: { lit: number, side: BattleSide, className?: string }) => (
  <div className={clsx(styles.hp, className)}>
    {Array.from({ length: 10 }, (_, i) => (
      <i key={i} className={clsx(styles.hpCell, i < lit && (side === 1 ? styles.hpOne : styles.hpTwo))} />
    ))}
  </div>
)

const sideTone = (at: BattleSide) => (at === 1 ? styles.one : styles.two)

/** 13e / 13e2 · the fighter's own round. The HP cells are the song's time
 *  left (U-14): all ten at the top of the cut, none at the end. */
const Singing = ({ turn, side, msLeft }: { turn: BattleTurn, side: BattleSide, msLeft: number }) => {
  const me = sideOf(turn, side)

  return (
    <BattleFrame bar={side === 1 ? 'red' : 'green'} status={`Round ${side}`} statusTone={side === 1 ? 'red' : 'green'}>
      <div className={styles.onHead}>
        <span className={clsx(styles.chip, sideTone(side))}>{`P${side} · You`}</span>
        <span className={clsx(styles.youreOn, side === 2 && styles.youreOnTwo)}>{'YOU\'RE ON'}</span>
        <span className={styles.songTitle} translate='no'>{me.song.title}</span>
        <span className={styles.songArtist} translate='no'>{me.song.artist}</span>
      </div>

      <div className={clsx(styles.stage, side === 1 ? styles.groundOne : styles.groundTwo)}>
        <Location singer={me.singer} className={styles.dimHalf} />
        <SpriteLoop
          singer={me.singer}
          loop='sing'
          size='560px'
          facing={side === 1 ? 'right' : 'left'}
          className={styles.bigSprite}
        />
      </div>

      <div className={styles.singFoot}>
        <div className={styles.singRow}>
          <span className={styles.singCue}>Sing to the room · watch the TV</span>
          <span className={clsx(styles.singClock, sideTone(side))}>{formatDuration(Math.ceil(msLeft / 1000))}</span>
        </div>
        <HpGrid lit={Math.ceil(10 * msLeft / BATTLE_SING_MS)} side={side} />
      </div>
    </BattleFrame>
  )
}

interface BattleResultProps {
  turn: BattleTurn
  /** The fighter holding this phone, or null for a watcher (13j3). */
  side: BattleSide | null
  /** A watcher's vote, for the Your-vote row. None on a missed ballot. */
  vote?: BattleSide | null
  onBack: () => void
  /** 13j2's key: the loser goes again. */
  onRematch?: () => void
}

/**
 * 13j / 13j2 / 13j3 · the verdict on a phone. The winner standing in their own
 * room (a fighter always sees their own), the two counts as bars, and what it
 * was worth.
 *
 * A draw is not designed: nobody took it, so the headline is a sentence and
 * both fighters get 13j2 with Battle played +250.
 */
export const BattleResult = ({ turn, side, vote, onBack, onRematch }: BattleResultProps) => {
  const tonight = useAppSelector(myStanding).points
  const one = sideOf(turn, 1)
  const two = sideOf(turn, 2)
  const isDraw = one.score === two.score
  const winnerAt: BattleSide = one.score > two.score ? 1 : 2
  const winner = winnerAt === 1 ? one : two
  const didWin = !isDraw && side === winnerAt
  const focus = side ? sideOf(turn, side) : isDraw ? null : winner
  const total = Math.max(1, one.score + two.score)
  // 13j sets the names in a 64px column with 28px counts; 13j2 and 13j3 in 92/24
  const isNarrow = didWin

  return (
    <BattleFrame
      bar={side && !didWin ? 'grey' : 'gold'}
      status='Result'
      statusTone={side && !didWin ? 'red' : 'gold'}
    >
      <div className={styles.resultStage}>
        {focus && <Location singer={focus.singer} className={styles.dimResult} />}
        {focus && <img className={styles.keyArt} src={battleSingerKeyArt(focus.singer).url} alt='' />}
        <div className={styles.resultHead}>
          {isDraw
            ? <span className={styles.drawLine}>A draw · nobody took it</span>
            : side === null
              ? (
                  <span className={clsx(styles.headline, styles.wins)} translate='no'>
                    {winner.name}
                    <br />
                    WINS
                  </span>
                )
              : didWin
                ? <span className={clsx(styles.headline, styles.youWin)}>YOU WIN</span>
                : <span className={clsx(styles.headline, styles.ko)}>K.O.</span>}
          {side && !isDraw && (
            <span className={styles.versus} translate='no'>
              {didWin ? `vs ${sideOf(turn, side === 1 ? 2 : 1).name}` : `${winner.name} wins`}
            </span>
          )}
        </div>
      </div>

      <div className={styles.stats}>
        {([1, 2] as BattleSide[]).map((at) => {
          const fighter = at === 1 ? one : two

          return (
            <div className={styles.statRow} key={at}>
              <span className={clsx(styles.statName, sideTone(at), isNarrow && styles.statNameNarrow)} translate='no'>
                {at === side ? 'You' : fighter.name}
              </span>
              <div className={styles.statBar}>
                <div className={clsx(styles.statFill, sideTone(at))} style={{ width: `${fighter.score / total * 100}%` }} />
              </div>
              <span className={clsx(styles.statCount, isNarrow && styles.statCountWide)}>{fighter.score}</span>
            </div>
          )
        })}

        {side && (
          <>
            <div className={clsx(styles.line, didWin && styles.lineGap)}>
              <span className={styles.lineLabel}>{didWin ? 'Battle win' : 'Battle played'}</span>
              <span className={styles.award}>{`+${didWin ? POINTS_BATTLE_WIN : POINTS_BATTLE_TAKE_PART}`}</span>
            </div>
            <div className={styles.line}>
              <span className={styles.lineLabel}>Tonight</span>
              <span className={styles.tonight}>{tonight}</span>
            </div>
          </>
        )}

        {!side && vote && (
          <div className={clsx(styles.line, styles.lineGap)}>
            <span className={styles.lineLabel}>Your vote</span>
            <span className={clsx(styles.yourVote, !isDraw && vote !== winnerAt && styles.yourVoteMissed)} translate='no'>
              {!isDraw && vote === winnerAt ? `${sideOf(turn, vote).name} ✓` : sideOf(turn, vote).name}
            </span>
          </div>
        )}
      </div>

      <div className={styles.resultFoot}>
        {side && !didWin && onRematch
          ? <BattleKey onClick={onRematch}>Rematch</BattleKey>
          : <BattleKey onClick={onBack}>Back to songs</BattleKey>}
      </div>
    </BattleFrame>
  )
}

/** 13e / 13e2 during the fighter's own round. Nothing on the other beats:
 *  the TV is the show, and the next thing this phone draws is the verdict. */
const BattleFighter = ({ turn, side, msLeft }: { turn: BattleTurn, side: BattleSide, msLeft: number }) => (
  turn.phase === (side === 1 ? 'sing1' : 'sing2')
    ? <Singing turn={turn} side={side} msLeft={msLeft} />
    : null
)

export default BattleFighter
