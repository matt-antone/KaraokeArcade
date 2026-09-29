import React, { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import alertCue from 'lib/alertCue'
import useBattleStage, { sideOfPhase } from 'lib/useBattleStage'
import {
  BATTLE_LOCKUP,
  BATTLE_STAGE_PLATE,
  battleSingerOrDefault,
  battleSingerPortrait,
  battleSingerStage,
} from 'lib/battleSingers'
import { castBattleVote } from 'store/modules/battle'
import { BATTLE_JUDGE_BALLOT_MS } from 'shared/types'
import type { BattleSide, BattleSong, BattleTurn } from 'shared/types'
import styles from './BattleVote.css'

/**
 * The room's phone, for the whole of a battle.
 *
 * A room decides a battle one of two ways. The microphone can only be heard by
 * the machine the player is open on, which in most rooms is nobody's — so the
 * default is this: everybody votes on the thing already in their hand.
 *
 * Silent in both directions. Nobody is told who voted for whom, and nobody —
 * including the room, on the TV — sees the count until the verdict. A tally
 * that fills in public collects the undecided behind whoever is ahead, which
 * is a vote about who was quickest rather than about who sang. The only
 * confirmation a voter gets is their own key, which is confirmation enough.
 *
 * Five screens, one per thing there is to say, and the beat on stage picks
 * between them — there is no client-run sequence here and no step this screen
 * advances by itself:
 *
 *   WAITING  the battle is running and neither song has been judged yet
 *   BALLOT   the judge beat, thirty seconds, nothing cast from this phone
 *   CAST     the judge beat, this phone has voted
 *   RESULT   the verdict beat, this phone voted
 *   MISSED   the verdict beat, this phone did not
 *
 * The two fighters get none of it. They are holding a microphone rather than a
 * phone, the ballot is not theirs to cast, and BattleStrip already captions the
 * battle for everyone — a full-screen takeover aimed at the person least able
 * to look at it is a screen nobody reads.
 *
 * Drawn to Arcade Flow v2's 13h (vote), 13h2 (vote locked) and 13j3 (winner,
 * for watchers). Watchers earn nothing from a battle, so no points appear
 * here; the fighters' own phones are BattleStrip's.
 */

/** A fighter's own room, behind their half of the ballot and behind the
 *  winner. Most fighters ship no location.png, so the 404 is the ordinary
 *  path and falls back to the dive bar — the TV's stage plate makes the same
 *  bargain. */
const Room = ({ src }: { src: string }) => {
  const [isMissing, setIsMissing] = useState(false)

  return (
    <img
      key={src}
      className={styles.room}
      src={isMissing ? BATTLE_STAGE_PLATE : src}
      alt=''
      onError={() => setIsMissing(true)}
    />
  )
}

/** What a fighter sang, in the one form every screen here shows it. */
const songLine = (song: BattleSong) => `${song.title} \u2014 ${song.artist}`

/** Everything either half of the fight has, by side. One accessor rather than
 *  a ternary per field: the five screens below read four of these each, and a
 *  side that is right in four places and wrong in the fifth is the bug this
 *  shape exists to make impossible. */
const sideOf = (turn: BattleTurn, at: BattleSide) => (at === 1
  ? {
      name: turn.challengerName,
      song: turn.challengerSong,
      score: turn.challengerScore,
      singer: battleSingerOrDefault(turn.challengerSingerId),
    }
  : {
      name: turn.opponentName,
      song: turn.opponentSong,
      score: turn.opponentScore,
      singer: battleSingerOrDefault(turn.opponentSingerId),
    })

/** The iris grows out of the point the thumb just left, so the screen changes
 *  under cover rather than cutting. `isCovering` holds the ballot up for the
 *  first 170ms of it — the vote itself is already sent by then, because a vote
 *  waiting on an animation timer is a vote a closing beat can eat. */
interface Iris {
  x: string
  y: string
  tone: string
  isCovering: boolean
}

/** The HUD's right-hand word, per screen. */
const STATUS = {
  waiting: 'LIVE',
  ballot: 'VOTING',
  cast: 'VOTED',
  result: 'RESULT',
  missed: 'CLOSED',
}

/** Mid-iris, where the swap is invisible. */
const COVER_MS = 170
/** Just past the 460ms keyframes, so nothing is unmounted mid-animation. */
const BURST_MS = 470

const BattleVote = () => {
  const dispatch = useAppDispatch()
  const { turn, phase, msLeft } = useBattleStage()
  const userId = useAppSelector(state => state.user.userId)
  const handle = useAppSelector(state => state.user.name)
  const vote = useAppSelector(state => state.battle.vote)

  const rootRef = useRef<HTMLDivElement>(null)
  const [iris, setIris] = useState<Iris | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const isFighting = !!turn && (userId === turn.challengerUserId || userId === turn.opponentUserId)
  // Crowd judging is graded by the player's own microphone and has no phone
  // screen at all — drawing one would ask a room for a vote nothing counts.
  const isBallotRoom = !!turn && turn.judging === 'ballot' && !isFighting
  const hasVoted = !!turn && vote?.queueId === turn.queueId

  const screen = !isBallotRoom || !turn
    ? null
    : phase === 'judge'
      ? (hasVoted && !iris?.isCovering ? 'cast' : 'ballot')
      : phase === 'winner'
        ? (hasVoted ? 'result' : 'missed')
        : 'waiting'

  // The ballot opening is the only notice a guest gets, and it arrives on a
  // phone that is face down as often as not.
  const isAsking = screen === 'ballot'
  useEffect(() => {
    if (isAsking) alertCue()
  }, [isAsking])

  if (!turn || !screen) return null

  const one = sideOf(turn, 1)
  const two = sideOf(turn, 2)
  const seconds = Math.ceil(msLeft / 1000)
  const isUrgent = seconds <= 10

  const onVote = (at: BattleSide, e: React.MouseEvent<HTMLButtonElement>) => {
    const frame = rootRef.current?.getBoundingClientRect()
    const key = e.currentTarget.getBoundingClientRect()

    // Sent first and animated second. The iris is decoration; the vote is the
    // only thing on this screen that has to survive a phone that backgrounds
    // itself the instant a thumb lifts.
    dispatch(castBattleVote(turn.queueId, at))

    if (!frame) return

    timers.current.forEach(clearTimeout)
    setIris({
      x: `${Math.round((key.left + key.width / 2 - frame.left) / frame.width * 100)}%`,
      y: `${Math.round((key.top + key.height / 2 - frame.top) / frame.height * 100)}%`,
      tone: at === 1 ? 'var(--arc-red)' : 'var(--arc-green)',
      isCovering: true,
    })
    timers.current = [
      window.setTimeout(() => setIris(was => was && { ...was, isCovering: false }), COVER_MS),
      window.setTimeout(() => setIris(null), BURST_MS),
    ]
  }

  /** WAITING · both fighters, and which of them the room is listening to. */
  const waiting = (
    <div className={styles.body}>
      <div className={styles.masthead}>
        <div className={styles.title}>
          BATTLE
          <br />
          IN PROGRESS
        </div>
        <div className={styles.lede}>
          VOTING OPENS WHEN BOTH HAVE SUNG
          <br />
          WATCH THE BIG SCREEN
        </div>
      </div>

      <div className={styles.gap} />

      <div className={styles.roster}>
        {([1, 2] as BattleSide[]).map((at) => {
          const fighter = sideOf(turn, at)
          const singing = sideOfPhase(phase)
          const isOnStage = singing === at
          // A side that has already sung has nothing left to say about itself,
          // and 'UP NEXT' on a finished turn reads as a song about to start.
          const isSpent = singing !== null && singing > at

          return (
            <div className={styles.rosterRow} key={at}>
              <img
                className={clsx(styles.portrait, at === 1 ? styles.ringOne : styles.ringTwo)}
                src={battleSingerPortrait(fighter.singer)}
                alt=''
              />
              <div className={styles.rosterText}>
                <div
                  className={clsx(styles.rosterName, at === 1 ? styles.tintOne : styles.tintTwo)}
                  translate='no'
                >
                  {fighter.name}
                </div>
                <div className={styles.rosterSong} translate='no'>{songLine(fighter.song)}</div>
              </div>
              <div className={clsx(styles.status, isOnStage && styles.statusLive)}>
                {isOnStage ? 'ON STAGE' : isSpent ? 'SUNG' : 'UP NEXT'}
              </div>
            </div>
          )
        })}
      </div>

      <div className={clsx(styles.footer, styles.footerCue)}>YOUR PHONE BUZZES WHEN IT IS TIME</div>
    </div>
  )

  /** BALLOT · 13h: the two fighters stacked in their own rooms with VS
   *  between them, and each half is the key that votes for it. Then the ask,
   *  the clock and the rule. */
  const ballot = (
    <div className={clsx(styles.body, styles.slam)}>
      <div className={styles.keys}>
        {([1, 2] as BattleSide[]).map((at) => {
          const fighter = sideOf(turn, at)

          return (
            <React.Fragment key={at}>
              {at === 2 && <div className={styles.vsBand}>VS</div>}
              <button
                type='button'
                className={clsx(styles.key, at === 1 ? styles.keyOne : styles.keyTwo)}
                onClick={e => onVote(at, e)}
              >
                <Room src={battleSingerStage(fighter.singer)} />
                <img className={styles.keyArt} src={battleSingerPortrait(fighter.singer, 80)} alt='' />
                <span className={styles.keyText}>
                  <span className={styles.keyLabel}>{`VOTE P${at}`}</span>
                  <span className={styles.keyName} translate='no'>{fighter.name}</span>
                  <span className={styles.keySong} translate='no'>{songLine(fighter.song)}</span>
                </span>
              </button>
            </React.Fragment>
          )
        })}
      </div>

      <div className={styles.askPanel}>
        <div className={styles.clockRow}>
          <div className={styles.ask}>WHO WINS?</div>
          <div className={clsx(styles.clock, isUrgent && styles.clockUrgent)}>
            {`0:${String(seconds).padStart(2, '0')}`}
          </div>
        </div>
        <div className={styles.clockWell}>
          <div
            className={styles.clockFill}
            style={{ width: `${Math.max(0, Math.min(1, msLeft / BATTLE_JUDGE_BALLOT_MS)) * 100}%` }}
          />
        </div>
        <div className={styles.lede}>ONE VOTE &middot; ANONYMOUS &middot; NO TAKEBACKS</div>
      </div>
    </div>
  )

  const picked = sideOf(turn, vote?.side ?? 1)

  /* One cell per phone in the room, and every filled one looks identical
     whichever way it voted. That is the whole point: the room can see that
     voting is happening and cannot see the split, because a visible tally
     makes late voters follow the leader.

     Both numbers come off the turn, because both are the server's to count.
     The room is measured once as the battle starts and has the two fighters
     taken off it — neither of them votes — and the count is re-sent on every
     vote with both scores still reading zero. Nothing here is derived from
     what this phone happens to have seen: a count assembled locally would be
     a different number on every phone in the room, which is worse than no
     count at all.

     The floor of 1 is for the room of one that is really a room of none — a
     denominator of zero draws no cells and reads as a broken screen rather
     than as an empty one. */
  const roomSize = Math.max(1, turn.ballotsOf)
  const ballotsIn = Math.min(turn.ballotsIn, roomSize)

  /** CAST · 13h2: sealed, and the room filling up around it. */
  const cast = (
    <div className={clsx(styles.body, styles.slam, styles.centred)}>
      <div className={clsx(styles.pick, vote?.side === 2 ? styles.pickTwo : styles.pickOne)}>
        <img className={styles.pickArt} src={battleSingerPortrait(picked.singer, 80)} alt='' />
      </div>

      <div className={styles.castTitle}>VOTE IN</div>

      <div className={styles.pickText}>
        <span className={styles.pickLabel}>YOU VOTED</span>
        {' '}
        <span
          className={clsx(styles.pickName, vote?.side === 2 ? styles.tintTwo : styles.tintOne)}
          translate='no'
        >
          {picked.name}
        </span>
      </div>

      <div className={styles.tally}>
        <div className={styles.cells}>
          {Array.from({ length: roomSize }, (_, i) => (
            <div key={i} className={clsx(styles.cell, i < ballotsIn && styles.cellIn)} />
          ))}
        </div>
        <div className={styles.count}>{`${ballotsIn} OF ${roomSize} IN`}</div>
        <div className={styles.closes}>{`RESULTS ON THE TV \u00b7 0:${String(seconds).padStart(2, '0')}`}</div>
      </div>

      <div className={styles.footer}>YOU CANNOT CHANGE IT</div>
    </div>
  )

  const isDraw = one.score === two.score
  const didWinOne = one.score > two.score
  const winner = didWinOne ? one : two
  const wasRight = (vote?.side === 1) === didWinOne

  /** RESULT · 13j3: the winner standing in their own room, the tally it
   *  was hidden behind as two bars, and whether this phone was on the right
   *  side of it. */
  const total = Math.max(1, one.score + two.score)
  const result = (
    <div className={clsx(styles.body, styles.slam, styles.slamCentre)}>
      <div className={styles.hero}>
        {!isDraw && <Room src={battleSingerStage(winner.singer)} />}
        {!isDraw && <img className={styles.heroArt} src={battleSingerPortrait(winner.singer, 80)} alt='' />}
        <div className={styles.heroText}>
          <div className={styles.decided}>THE ROOM DECIDED</div>
          <div className={styles.winner} translate='no'>{isDraw ? 'A DRAW' : winner.name}</div>
        </div>
      </div>

      <div className={styles.plates}>
        {([1, 2] as BattleSide[]).map((at) => {
          const fighter = sideOf(turn, at)

          return (
            <div className={clsx(styles.plate, at === 1 ? styles.plateOne : styles.plateTwo)} key={at}>
              <div className={styles.plateName} translate='no'>{fighter.name}</div>
              <div className={styles.plateBar}>
                <div className={styles.plateFill} style={{ width: `${fighter.score / total * 100}%` }} />
              </div>
              <div className={styles.plateScore}>{String(fighter.score).padStart(2, '0')}</div>
            </div>
          )
        })}
      </div>

      <div
        className={clsx(
          styles.called,
          !isDraw && (wasRight ? styles.calledRight : styles.calledWrong),
        )}
      >
        {isDraw ? 'A DRAW · NOBODY TOOK IT' : wasRight ? 'YOU CALLED IT' : 'YOU BACKED THE OTHER ONE'}
      </div>
    </div>
  )

  /** MISSED · no recovery, no late vote. */
  const missed = (
    <div className={styles.missed}>
      <img className={styles.lockup} src={BATTLE_LOCKUP} alt='Singer Battle' />
      <div className={styles.missedTitle}>BALLOT CLOSED</div>
      <div className={styles.missedNote}>
        YOU DID NOT VOTE IN TIME
        <br />
        THE ROOM DECIDED WITHOUT YOU
      </div>
    </div>
  )

  return (
    <div
      className={styles.screen}
      ref={rootRef}
      style={iris ? { '--fx-x': iris.x, '--fx-y': iris.y } as React.CSSProperties : undefined}
    >
      {(screen === 'result' || screen === 'missed') && (
        <div className={clsx(styles.accent, screen === 'missed' && styles.accentSpent)} />
      )}

      {/* 13h's HUD row: the feature, who is holding the phone, and what this
          screen is doing. */}
      <div className={styles.header}>
        <div className={styles.wordmark}>BATTLE</div>
        <div className={styles.handle} translate='no'>{handle}</div>
        <div className={styles.hudStatus}>{STATUS[screen]}</div>
      </div>

      {screen === 'waiting' && waiting}
      {screen === 'ballot' && ballot}
      {screen === 'cast' && cast}
      {screen === 'result' && result}
      {screen === 'missed' && missed}

      {/* Over everything, touchable through: the CRT wash every screen in the
          redesign carries. */}
      <div className={styles.scanlines} />

      {iris && (
        <div className={styles.fx}>
          <div className={styles.iris} style={{ backgroundColor: iris.tone }} />
          <div className={styles.ring} style={{ borderColor: iris.tone }} />
        </div>
      )}
    </div>
  )
}

export default BattleVote
