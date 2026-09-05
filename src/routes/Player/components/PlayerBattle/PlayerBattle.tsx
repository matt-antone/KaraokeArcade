import React, { useEffect, useRef } from 'react'
import clsx from 'clsx'
import UserImage from 'components/UserImage/UserImage'
import VuMeter from 'components/VuMeter/VuMeter'
import useBattleStage, { sideOfPhase } from 'lib/useBattleStage'
import { useAppSelector } from 'store/hooks'
import { formatDuration } from 'lib/dateTime'
import createVersusSting from './versusSting'
import useCrowdMic from './useCrowdMic'
import type { BattleSide, BattleSong, BattleTurn } from 'shared/types'
import { CHEER, GROAN, playCue, soundCue } from 'lib/soundCue'
import styles from './PlayerBattle.css'

const sideClass = (side: BattleSide) => (side === 1 ? styles.sideOne : styles.sideTwo)

const nameOf = (turn: BattleTurn, side: BattleSide) =>
  (side === 1 ? turn.challengerName : turn.opponentName)

const songOf = (turn: BattleTurn, side: BattleSide): BattleSong =>
  (side === 1 ? turn.challengerSong : turn.opponentSong)

const avatarOf = (turn: BattleTurn, side: BattleSide) => (side === 1
  ? { userId: turn.challengerUserId, dateUpdated: turn.challengerDateUpdated }
  : { userId: turn.opponentUserId, dateUpdated: turn.opponentDateUpdated })

/** A song, set the way the whole deck sets one: the title carries, the artist
 *  is secondary ink under it. */
const songLines = (song: BattleSong) => (
  <div className={styles.song}>
    <div translate='no'>{song.title}</div>
    <div className={clsx(styles.songArtist)} translate='no'>{song.artist}</div>
  </div>
)

/** A fighter's portrait, name and song. The portrait is the same drawing on
 *  every beat that shows one, at whatever size that beat wants. */
const fighter = (turn: BattleTurn, side: BattleSide, isSolo?: boolean) => {
  const avatar = avatarOf(turn, side)

  return (
    <div className={clsx(styles.fighter, sideClass(side))}>
      <UserImage
        className={clsx(styles.portrait, isSolo && styles.portraitSolo)}
        userId={avatar.userId}
        dateUpdated={avatar.dateUpdated}
      />
      <div className={styles.name} translate='no'>{nameOf(turn, side)}</div>
      {songLines(songOf(turn, side))}
    </div>
  )
}

/** The VS slam's canvas. Its own component so the sting is created once when
 *  the versus beat mounts and destroyed when it gives way, rather than on every
 *  tick of the countdown behind it. */
const VersusSting = () => {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return

    const sting = createVersusSting(ref.current)

    // Michroma has to be resident before VS is drawn or the word lands in the
    // fallback face and never redraws — the sting parks itself after its last
    // frame, so there is no later frame to correct it.
    document.fonts.load('400 40px Michroma')
      .then(() => sting.play())
      .catch(() => sting.play())

    return () => sting.destroy()
  }, [])

  return <canvas ref={ref} className={styles.sting} aria-hidden />
}

interface PlayerBattleProps {
  /** The row this player is on. A beat for any other row is somebody else's
   *  battle arriving late and is not drawn. */
  queueId: number
  /** Player's own AudioContext, for the metering beats. Must be stable — it is
   *  an effect dependency, and a fresh arrow every render restarts the
   *  microphone on every tick of the clock. */
  getAudioCtx: () => AudioContext | null
  width: number
  height: number
}

/**
 * A battle on the TV: nine beats, one drawn at a time, none of them owned by
 * this component. The server decides which beat is up and when it ends; this
 * reads the current one off the clock through useBattleStage and draws exactly
 * that, so two players in a room cannot disagree about who is singing.
 *
 * Seven of the nine take the whole stage. The two singing beats do the
 * opposite — the media is the screen then, and this shrinks to a corner card
 * naming who is up and how long is left, which is the only thing the room
 * cannot work out by looking.
 */
const PlayerBattle = ({ queueId, getAudioCtx, width, height }: PlayerBattleProps) => {
  const { turn, phase, msLeft } = useBattleStage()
  // The last beat the server sent, expiry ignored. Only the holding card wants
  // this: it is the one thing that tells "the server has not answered yet"
  // apart from "it answered and then stopped".
  const stored = useAppSelector(state => state.battle.turn)

  // A beat for another row is not ours to draw. The player can reach a battle
  // row a moment before the server's first beat lands, and it can still be
  // holding the last beat of the *previous* battle when it does.
  const live = turn && turn.queueId === queueId ? turn : null
  const beat = live ? phase : null
  const side = sideOfPhase(beat)

  const meterSide = beat === 'meter1' || beat === 'meter2' ? side : null
  const crowd = useCrowdMic(queueId, meterSide, getAudioCtx)

  // The verdict lands with a noise, on the one machine in the room with
  // speakers. Best-effort throughout and nothing depends on it: autoplay
  // policy means the first sound on a TV box nobody has touched will not play,
  // and a battle that shows its winner in silence is still a battle.
  useEffect(() => {
    if (beat !== 'winner' || !live) return

    playCue(live.challengerScore === live.opponentScore ? GROAN : CHEER)
  }, [beat, live])

  // Both cues are fetched during the first splash, while there is nothing else
  // competing for the wifi. Which one plays is not known until the verdict, so
  // both are pulled.
  useEffect(() => {
    if (beat !== 'versus') return
    for (const src of [CHEER, GROAN]) soundCue(src).load()
  }, [beat])

  const stage = (children: React.ReactNode, className?: string) => (
    <div style={{ width, height }} className={clsx(styles.container, className)}>
      {children}
    </div>
  )

  // No beat yet, or one that has run out with its successor still in flight.
  // Something opaque has to hold the stage either way: this row's media is not
  // playing and the screen behind is the thread field.
  if (!live || !beat) {
    return stage(
      <>
        <div className={styles.headline}>Battle</div>
        {/* Two different silences, and the room can tell them apart even if it
            never knows the words for them. Nothing stored for this row means
            the server has not answered yet, which is a blink. A stored beat
            that has expired means one arrived and then stopped, which is the
            twenty seconds before PlayerController gives up on the row. */}
        <div className={styles.silk}>
          {stored?.queueId === queueId ? 'hold on' : 'getting ready'}
        </div>
      </>,
    )
  }

  if (beat === 'sing1' || beat === 'sing2') {
    const at = side ?? 1

    return (
      <div className={clsx(styles.corner, sideClass(at))}>
        <div className={styles.cornerBar} />
        <div className={styles.cornerText}>
          <div className={styles.cornerName} translate='no'>{nameOf(live, at)}</div>
          <div className={styles.cornerSong} translate='no'>
            {songOf(live, at).title}
            {' '}
            -
            {songOf(live, at).artist}
          </div>
        </div>
        {/* A two-minute cut counted in bare seconds opens at 120, which reads
            as a score rather than a clock. formatDuration is what every other
            length in the app is set in. */}
        <div className={styles.cornerClock}>{formatDuration(Math.ceil(msLeft / 1000))}</div>
      </div>
    )
  }

  if (beat === 'intro1' || beat === 'intro2') {
    const at = side ?? 1

    return stage(
      <>
        <div className={styles.silk}>{at === 1 ? 'challenger' : 'opponent'}</div>
        <div className={clsx(styles.solo, sideClass(at))}>
          {fighter(live, at, true)}
        </div>
      </>,
    )
  }

  if (beat === 'judge') {
    return stage(
      <>
        <div className={styles.headline}>Who wins</div>
        <div className={styles.subhead} translate='no'>
          {live.challengerName}
          {' '}
          vs
          {live.opponentName}
        </div>
      </>,
    )
  }

  if (beat === 'meter1' || beat === 'meter2') {
    const at = side ?? 1

    return stage(
      <>
        <div className={styles.silk}>make some noise for</div>
        <div className={styles.headline} translate='no'>{nameOf(live, at)}</div>
        {/* The rare caller that wants VuMeter's default peakFrom: this really
            is an audio level, and the top of the scale really should go red. */}
        <VuMeter
          className={styles.meter}
          value={crowd.level}
          height={40}
          label={`How loud the room is for ${nameOf(live, at)}`}
        />
        {/* The bar is a level and the verdict is a number, and until now the
            room only ever saw the first. Same type as the winner beat's scores
            on purpose: this is that number, still moving. */}
        <div className={styles.gradeScore}>{crowd.grade}</div>
        {/* Only the second fighter has something to beat. On meter1 there is
            no target yet, and inventing one — a par, an average — would be a
            number the battle does not actually use. */}
        {at === 2 && (
          <div className={styles.silk}>
            {'to beat '}
            {live.challengerScore}
          </div>
        )}
      </>,
      sideClass(at),
    )
  }

  if (beat === 'winner') {
    const isDraw = live.challengerScore === live.opponentScore
    const winner = live.challengerScore > live.opponentScore ? 1 : 2

    return stage(
      <>
        <div className={clsx(styles.headline, styles.verdict)} translate='no'>
          {isDraw ? 'Draw' : `${nameOf(live, winner)} wins`}
        </div>
        <div className={styles.grades}>
          {([1, 2] as BattleSide[]).map(at => (
            <div key={at} className={clsx(styles.grade, sideClass(at))}>
              <div className={styles.gradeScore}>
                {at === 1 ? live.challengerScore : live.opponentScore}
              </div>
              <div className={styles.gradeName} translate='no'>{nameOf(live, at)}</div>
            </div>
          ))}
        </div>
        {!live.isJudgedByCrowd && (
          <div className={styles.silk}>this player cannot hear the room</div>
        )}
      </>,
    )
  }

  // 'versus'
  return stage(
    <>
      <VersusSting />
      <div className={styles.fighters}>
        {fighter(live, 1)}
        {fighter(live, 2)}
      </div>
    </>,
  )
}

export default PlayerBattle
