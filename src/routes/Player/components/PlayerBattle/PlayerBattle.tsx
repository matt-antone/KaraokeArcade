import React, { useEffect } from 'react'
import clsx from 'clsx'
import useBattleStage, { sideOfPhase } from 'lib/useBattleStage'
import { useAppSelector } from 'store/hooks'
import { BATTLE_LOCKUP, BATTLE_STAGE_PLATE, battleSingerOrDefault, battleSingerStage } from 'lib/battleSingers'
import { CHEER, GROAN, playCue, soundCue } from 'lib/soundCue'
import { nightPointsByUser } from 'store/selectors/points'
import { Intro, Judge, Meter, Sing, StagePlate, Versus, Winner, type BattleUpNext } from './battleBeats'
import useCrowdMic from './useCrowdMic'
import type { BattlePhase, BattleSide, BattleTurn } from 'shared/types'
import styles from './PlayerBattle.css'

/** How the room sits behind each beat.
 *
 *  A table rather than a chain of guards, because this and the beat table
 *  below are the two things here most likely to be got wrong. The ready cards
 *  (13d/13f) and the verdict (13i) show the room at full light under their
 *  own gradients; the rounds (13e/13g) wash it with 35% of the ground; the
 *  versus and the vote draw both rooms over it, so it is only ever glimpsed. */
const PLATE_TONE: Record<BattlePhase, string | null> = {
  logo: styles.toneDark,
  versus: styles.toneDark,
  intro1: null,
  intro2: null,
  sing1: styles.toneSing,
  sing2: styles.toneSing,
  judge: styles.toneDark,
  meter1: styles.toneDrained,
  meter2: styles.toneDrained,
  winner: null,
}

/** The panel the karaoke video shows through, cut out of the plate on the side
 *  away from the singer. Only the two singing beats have one. */
const PLATE_HOLE: Partial<Record<BattlePhase, string>> = {
  sing1: styles.holeOne,
  sing2: styles.holeTwo,
}

/** The TV's own scanline layer (G4: global.css stands down on the TV), at the
 *  z-index each design screen draws it: over everything on the ready cards
 *  (z5), under the word art on the versus, the vote and the verdict (z9), and
 *  none at all on the rounds, where the video is clean. */
const SCANLINES: Partial<Record<BattlePhase, string>> = {
  logo: styles.scanlines,
  versus: styles.scanlines,
  intro1: clsx(styles.scanlines, styles.scanlinesLow),
  intro2: clsx(styles.scanlines, styles.scanlinesLow),
  judge: styles.scanlines,
  meter1: styles.scanlines,
  meter2: styles.scanlines,
  winner: styles.scanlines,
}

/** Whose room a beat stands in (U-10b): the challenger's through their own
 *  round, the opponent's through theirs, and the winner's on the verdict —
 *  the challenger's on a draw. */
const plateSideOf = (turn: BattleTurn, beat: BattlePhase): BattleSide => {
  if (beat === 'winner') return turn.opponentScore > turn.challengerScore ? 2 : 1

  return sideOfPhase(beat) ?? 1
}

interface PlayerBattleProps {
  /** The row this player is on. A beat for any other row is somebody else's
   *  battle arriving late and is not drawn. */
  queueId: number
  /** Player's own AudioContext, for the metering beats. Must be stable — it is
   *  an effect dependency, and a fresh arrow every render restarts the
   *  microphone on every tick of the clock. */
  getAudioCtx: () => AudioContext | null
  /** @deprecated 13i draws no up-next strip. Still accepted so the player can
   *  stop passing it on its own schedule; nothing reads it. */
  upNext?: BattleUpNext | null
  width: number
  height: number
}

/**
 * The stage itself: a 16:9 box, centred, with one custom property on it.
 *
 * Everything drawn inside is measured in design units off `--px`, so the whole
 * screen rescales as one piece to any TV, projector or window. 384 x 216 units
 * is the design's 960 x 540 at 0.4, so a 16:9 display is filled edge to edge
 * and anything else is letterboxed or pillarboxed around it.
 */
const Stage = ({ width, height, beat, plate, children }: {
  width: number
  height: number
  /** null while the row is waiting for its first payload — no plate, no tone. */
  beat: BattlePhase | null
  /** The room this beat stands in, or the dive bar when there is no fight yet. */
  plate: string
  children: React.ReactNode
}) => (
  <div style={{ width, height }} className={styles.well}>
    <div
      style={{ width: Math.min(width, Math.round(height * 16 / 9)) }}
      className={clsx(styles.stage, beat && PLATE_HOLE[beat] && styles.stageOpen)}
    >
      {beat && (
        <div className={clsx(styles.plateBox, PLATE_TONE[beat], PLATE_HOLE[beat])}>
          <StagePlate src={plate} />
        </div>
      )}
      {children}
      {beat && SCANLINES[beat] && <div className={SCANLINES[beat]} />}
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
  venue: string | undefined,
  night: Record<number, number>,
): React.ReactNode => {
  switch (beat) {
    // `logo` is never sent now (D10): the lockup opens the versus scene
    case 'logo':
    case 'versus':
      return <Versus turn={turn} msLeft={msLeft} />
    case 'intro1':
    case 'intro2':
      return <Intro turn={turn} at={at} venue={venue} />
    case 'sing1':
    case 'sing2':
      return <Sing turn={turn} at={at} msLeft={msLeft} />
    case 'judge':
      return <Judge turn={turn} msLeft={msLeft} venue={venue} />
    case 'meter1':
    case 'meter2':
      return <Meter turn={turn} at={at} level={crowd.level} grade={crowd.grade} msLeft={msLeft} />
    case 'winner':
      return <Winner turn={turn} msLeft={msLeft} night={night} />
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
const PlayerBattle = ({ queueId, getAudioCtx, width, height }: PlayerBattleProps) => {
  const { turn, phase, msLeft } = useBattleStage()
  // The last beat the server sent, expiry ignored. Only the holding card wants
  // this: it is the one thing that tells "the server has not answered yet"
  // apart from "it answered and then stopped".
  const stored = useAppSelector(state => state.battle.turn)
  const venue = useAppSelector(state => (
    state.user.roomId == null ? undefined : state.rooms.entities[state.user.roomId]?.name
  ))
  const night = useAppSelector(nightPointsByUser)

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

  // Off the snapshot rather than the account, so a battle is drawn as it
  // was fought.
  const plate = live && beat
    ? battleSingerStage(battleSingerOrDefault(
        plateSideOf(live, beat) === 1 ? live.challengerSingerId : live.opponentSingerId,
      ))
    : BATTLE_STAGE_PLATE

  return (
    <Stage width={width} height={height} beat={beat} plate={plate}>
      {live && beat
        ? beatContent(beat, live, at, crowd, msLeft, venue, night)
        : <Holding isStarted={stored?.queueId === queueId} />}
    </Stage>
  )
}

export default PlayerBattle
