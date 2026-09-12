import React, { useEffect, useRef } from 'react'
import clsx from 'clsx'
import UserImage from 'components/UserImage/UserImage'
import VuMeter from 'components/VuMeter/VuMeter'
import useBattleStage, { sideOfPhase } from 'lib/useBattleStage'
import { useAppSelector } from 'store/hooks'
import { formatDuration } from 'lib/dateTime'
import createVersusSting from './versusSting'
import useCrowdMic from './useCrowdMic'
import type { BattlePhase, BattleSide, BattleSong, BattleTurn } from 'shared/types'
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

/** Everything that takes the whole stage sits in this: opaque, because this row's
 *  media is not playing and the thread field behind stops drawing while it shows. */
const Stage = ({ width, height, className, children }: {
  width: number
  height: number
  className?: string
  children: React.ReactNode
}) => (
  <div style={{ width, height }} className={clsx(styles.container, className)}>
    {children}
  </div>
)

/** No beat yet, or one that has run out with its successor still in flight.
 *
 *  Two different silences, and the room can tell them apart even if it never
 *  knows the words for them. Nothing stored for this row means the server has
 *  not answered yet, which is a blink. A stored beat that has expired means one
 *  arrived and then stopped, which is the twenty seconds before PlayerController
 *  gives up on the row. */
const Holding = ({ isStarted }: { isStarted: boolean }) => (
  <>
    <div className={styles.headline}>Battle</div>
    <div className={styles.silk}>{isStarted ? 'hold on' : 'getting ready'}</div>
  </>
)

/** A singing beat: the media is the screen, so this is a corner card naming who
 *  is up and how long is left — the only thing the room cannot work out by
 *  looking. The one beat that does not take the stage. */
const SingCorner = ({ turn, at, msLeft }: { turn: BattleTurn, at: BattleSide, msLeft: number }) => (
  <div className={clsx(styles.corner, sideClass(at))}>
    <div className={styles.cornerBar} />
    <div className={styles.cornerText}>
      <div className={styles.cornerName} translate='no'>{nameOf(turn, at)}</div>
      <div className={styles.cornerSong} translate='no'>
        {songOf(turn, at).title}
        {' '}
        -
        {songOf(turn, at).artist}
      </div>
    </div>
    {/* A two-minute cut counted in bare seconds opens at 120, which reads as a
        score rather than a clock. formatDuration is what every other length in
        the app is set in. */}
    <div className={styles.cornerClock}>{formatDuration(Math.ceil(msLeft / 1000))}</div>
  </div>
)

/** One fighter alone, at the size the far sofa reads. */
const Intro = ({ turn, at }: { turn: BattleTurn, at: BattleSide }) => (
  <>
    <div className={styles.silk}>{at === 1 ? 'challenger' : 'opponent'}</div>
    <div className={clsx(styles.solo, sideClass(at))}>
      {fighter(turn, at, true)}
    </div>
  </>
)

/** The question the two metering beats answer. */
const Judge = ({ turn }: { turn: BattleTurn }) => (
  <>
    <div className={styles.headline}>Who wins</div>
    <div className={styles.subhead} translate='no'>
      {turn.challengerName}
      {' '}
      vs
      {turn.opponentName}
    </div>
  </>
)

/** The room being measured for one fighter. */
const Meter = ({ turn, at, level, grade }: {
  turn: BattleTurn
  at: BattleSide
  level: number
  grade: number
}) => (
  <>
    <div className={styles.silk}>make some noise for</div>
    <div className={styles.headline} translate='no'>{nameOf(turn, at)}</div>
    {/* The rare caller that wants VuMeter's default peakFrom: this really is an
        audio level, and the top of the scale really should go red. */}
    <VuMeter
      className={styles.meter}
      value={level}
      height={40}
      label={`How loud the room is for ${nameOf(turn, at)}`}
    />
    {/* The bar is a level and the verdict is a number, and until now the room
        only ever saw the first. Same type as the winner beat's scores on
        purpose: this is that number, still moving. */}
    <div className={styles.gradeScore}>{grade}</div>
    {/* Only the second fighter has something to beat. On meter1 there is no
        target yet, and inventing one — a par, an average — would be a number
        the battle does not actually use. */}
    {at === 2 && (
      <div className={styles.silk}>
        {'to beat '}
        {turn.challengerScore}
      </div>
    )}
  </>
)

/** The verdict and both grades. */
const Winner = ({ turn }: { turn: BattleTurn }) => {
  const isDraw = turn.challengerScore === turn.opponentScore

  return (
    <>
      <div className={clsx(styles.headline, styles.verdict)} translate='no'>
        {isDraw ? 'Draw' : `${nameOf(turn, turn.challengerScore > turn.opponentScore ? 1 : 2)} wins`}
      </div>
      <div className={styles.grades}>
        {([1, 2] as BattleSide[]).map(at => (
          <div key={at} className={clsx(styles.grade, sideClass(at))}>
            <div className={styles.gradeScore}>
              {at === 1 ? turn.challengerScore : turn.opponentScore}
            </div>
            <div className={styles.gradeName} translate='no'>{nameOf(turn, at)}</div>
          </div>
        ))}
      </div>
      {turn.judging === 'ballot' && <div className={styles.silk}>votes</div>}
      {turn.judging === 'none' && (
        <div className={styles.silk}>this player cannot hear the room</div>
      )}
    </>
  )
}

/** Both fighters and both songs, before a note is played. */
/** The room votes on its phones. The TV's whole job here is to say that it is
 *  happening, to whom, and for how much longer — the count is deliberately not
 *  on screen, because a tally the room can watch collects the undecided behind
 *  whoever is ahead. See Battle.vote. */
const Ballot = ({ turn, msLeft }: { turn: BattleTurn, msLeft: number }) => (
  <>
    <div className={styles.silk}>vote on your phone</div>
    <div className={styles.headline}>Who wins</div>
    <div className={styles.fighters}>
      {fighter(turn, 1)}
      {fighter(turn, 2)}
    </div>
    <div className={styles.subhead}>{Math.ceil(msLeft / 1000)}</div>
  </>
)

const Versus = ({ turn }: { turn: BattleTurn }) => (
  <>
    <VersusSting />
    <div className={styles.fighters}>
      {fighter(turn, 1)}
      {fighter(turn, 2)}
    </div>
  </>
)

/** Which beat draws what. A lookup rather than a chain of guards inside the
 *  component: the mapping is the one thing here most likely to be got wrong,
 *  and it reads as a table when it is written as one. */
const beatContent = (
  beat: BattlePhase,
  turn: BattleTurn,
  at: BattleSide,
  crowd: { level: number, grade: number },
  msLeft: number,
): React.ReactNode => {
  switch (beat) {
    case 'versus':
      return <Versus turn={turn} />
    case 'intro1':
    case 'intro2':
      return <Intro turn={turn} at={at} />
    case 'judge':
      return <Judge turn={turn} />
    case 'ballot':
      return <Ballot turn={turn} msLeft={msLeft} />
    case 'meter1':
    case 'meter2':
      return <Meter turn={turn} at={at} level={crowd.level} grade={crowd.grade} />
    case 'winner':
      return <Winner turn={turn} />
    // the two singing beats never reach here: they are the one pair that does
    // not take the stage, and PlayerBattle returns their corner card first
    default:
      return null
  }
}

/**
 * A battle on the TV: nine beats, one drawn at a time, none of them owned by
 * this component. The server decides which beat is up and when it ends; this
 * reads the current one off the clock through useBattleStage and draws exactly
 * that, so two players in a room cannot disagree about who is singing.
 *
 * Seven of the nine take the whole stage. The two singing beats do the
 * opposite — the media is the screen then, and this shrinks to a corner card.
 *
 * Each beat is its own component above and this is only the switchboard: which
 * beat is up, which fighter it is about, and the two effects that belong to the
 * row rather than to any one beat.
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
  const at = side ?? 1

  // Only ever set on a crowd-judged fight — the server does not send a
  // metering beat to any other kind — but said in both places, because the one
  // thing that must never happen by accident is a microphone opening in a room
  // that asked for a silent ballot.
  const meterSide = live?.judging === 'crowd' && (beat === 'meter1' || beat === 'meter2') ? side : null
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

  if (!live || !beat) {
    return (
      <Stage width={width} height={height}>
        <Holding isStarted={stored?.queueId === queueId} />
      </Stage>
    )
  }

  // The one beat that does not take the stage.
  if (beat === 'sing1' || beat === 'sing2') {
    return <SingCorner turn={live} at={at} msLeft={msLeft} />
  }

  return (
    <Stage
      width={width}
      height={height}
      // Only the metering beats tint the whole stage in a fighter's colour; the
      // rest carry it on the parts that are about one fighter.
      className={meterSide ? sideClass(at) : undefined}
    >
      {beatContent(beat, live, at, crowd, msLeft)}
    </Stage>
  )
}

export default PlayerBattle
