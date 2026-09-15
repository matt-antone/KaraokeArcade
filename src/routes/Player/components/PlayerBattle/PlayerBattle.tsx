import React, { useEffect } from 'react'
import clsx from 'clsx'
import useBattleStage, { sideOfPhase } from 'lib/useBattleStage'
import { useAppSelector } from 'store/hooks'
import { BATTLE_LOCKUP, BATTLE_STAGE_PLATE } from 'lib/battleSingers'
import { CHEER, GROAN, playCue, soundCue } from 'lib/soundCue'
import { Intro, Judge, Logo, Meter, Sing, Versus, Winner, type BattleUpNext } from './battleBeats'
import useCrowdMic from './useCrowdMic'
import type { BattlePhase, BattleSide, BattleTurn } from 'shared/types'
import styles from './PlayerBattle.css'

/** How far back the stage plate sits on each beat.
 *
 *  A table rather than a chain of guards, because this and the beat table
 *  below are the two things here most likely to be got wrong, and both read as
 *  tables when they are written as ones. The singing beats are the only ones
 *  where the room is meant to be looking at the bar; everywhere else it is
 *  scenery behind something brighter, and a plate at full brightness under a
 *  scrim reads as fog rather than as a room. */
const PLATE_TONE: Record<BattlePhase, string> = {
  logo: styles.toneDark,
  versus: styles.toneDark,
  intro1: styles.toneIntro,
  intro2: styles.toneIntro,
  sing1: styles.toneSing,
  sing2: styles.toneSing,
  judge: styles.toneDark,
  meter1: styles.toneDrained,
  meter2: styles.toneDrained,
  winner: styles.toneDark,
}

/** The panel the karaoke video shows through, cut out of the plate on the side
 *  away from the singer. Only the two singing beats have one. */
const PLATE_HOLE: Partial<Record<BattlePhase, string>> = {
  sing1: styles.holeOne,
  sing2: styles.holeTwo,
}

interface PlayerBattleProps {
  /** The row this player is on. A beat for any other row is somebody else's
   *  battle arriving late and is not drawn. */
  queueId: number
  /** Player's own AudioContext, for the metering beats. Must be stable — it is
   *  an effect dependency, and a fresh arrow every render restarts the
   *  microphone on every tick of the clock. */
  getAudioCtx: () => AudioContext | null
  /** Who the room goes back to when the fight is over, drawn on the verdict
   *  beat. Null at the end of the queue, and for a next row that announces
   *  itself — see BattleUpNext. */
  upNext?: BattleUpNext | null
  width: number
  height: number
}

/**
 * The stage itself: a 12:7 box, centred, with one custom property on it.
 *
 * Everything drawn inside is measured in design units off `--px`, so the whole
 * screen rescales as one piece to any TV, projector or window. That is also why
 * the box is not simply stretched to the panel it is given: the plate art, the
 * sprite positions and every number in the design share one aspect ratio, and
 * on a 16:9 screen honouring it costs about 1.8% of pillarbox either side and
 * keeps the fighters' feet on the floor. The strips are left unpainted so the
 * two singing beats can let the karaoke video through them as well.
 */
const Stage = ({ width, height, beat, children }: {
  width: number
  height: number
  /** null while the row is waiting for its first payload — no plate, no tone. */
  beat: BattlePhase | null
  children: React.ReactNode
}) => (
  <div style={{ width, height }} className={styles.well}>
    <div
      style={{ width: Math.min(width, Math.round(height * 12 / 7)) }}
      className={clsx(styles.stage, beat && PLATE_HOLE[beat] && styles.stageOpen)}
    >
      {beat && (
        <div className={clsx(styles.plateBox, PLATE_TONE[beat], PLATE_HOLE[beat])}>
          <img className={styles.plate} src={BATTLE_STAGE_PLATE} alt='' />
        </div>
      )}
      {children}
    </div>
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
  <div className={styles.holding}>
    {/* The one non-pixel asset in the set, and the one image on this screen
        that has to be told not to sample like one. */}
    <img className={styles.lockup} src={BATTLE_LOCKUP} alt='Singer Battle' />
    <div className={clsx(styles.silk, styles.holdWord)}>
      {isStarted ? 'Hold on' : 'Getting ready'}
    </div>
  </div>
)

/** Which beat draws what. The other table, for the same reason as the first. */
const beatContent = (
  beat: BattlePhase,
  turn: BattleTurn,
  at: BattleSide,
  crowd: { level: number, grade: number },
  msLeft: number,
  upNext?: BattleUpNext | null,
): React.ReactNode => {
  switch (beat) {
    case 'logo':
      return <Logo />
    case 'versus':
      return <Versus turn={turn} />
    case 'intro1':
    case 'intro2':
      return <Intro turn={turn} at={at} />
    case 'sing1':
    case 'sing2':
      return <Sing turn={turn} at={at} msLeft={msLeft} />
    case 'judge':
      return <Judge turn={turn} msLeft={msLeft} />
    case 'meter1':
    case 'meter2':
      return <Meter turn={turn} at={at} level={crowd.level} grade={crowd.grade} msLeft={msLeft} />
    case 'winner':
      return <Winner turn={turn} msLeft={msLeft} upNext={upNext} />
  }
}

/**
 * A battle on the TV: one stage that changes what it holds as the server hands
 * out one beat at a time.
 *
 * It is not ten screens. Ten beats arrive, each as its own `BattleTurn` with
 * its own deadline, and this reads the current one off the clock through
 * useBattleStage and draws exactly that — so two players in a room cannot
 * disagree about who is singing. There are eight beats on the silent-ballot
 * path and nine when the room is scored on crowd noise; the server decides
 * which, and this only ever draws what it is sent.
 *
 * Each beat is its own component in battleBeats.tsx and this is the
 * switchboard: which beat is up, which fighter it is about, and the two effects
 * that belong to the row rather than to any one beat.
 *
 * Unlike the screen this replaced, the singing beats take the stage too. The
 * karaoke player is mounted underneath and shows through a hole cut in the
 * stage plate, so the fighter can stand beside the song rather than the whole
 * design standing down for four of a battle's five minutes.
 */
const PlayerBattle = ({ queueId, getAudioCtx, upNext, width, height }: PlayerBattleProps) => {
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

  // Both cues are fetched during the versus card, while the room is looking at
  // a still and there is nothing else competing for the wifi. Which one plays
  // is not known until the verdict, so both are pulled.
  useEffect(() => {
    if (beat !== 'versus') return
    for (const src of [CHEER, GROAN]) soundCue(src).load()
  }, [beat])

  return (
    <Stage width={width} height={height} beat={beat}>
      {live && beat
        ? beatContent(beat, live, at, crowd, msLeft, upNext)
        : <Holding isStarted={stored?.queueId === queueId} />}
    </Stage>
  )
}

export default PlayerBattle
