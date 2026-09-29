import React, { useState } from 'react'
import clsx from 'clsx'
import BattleLoop from './BattleLoop'
import useSpriteFrame from './useSpriteFrame'
import { formatDuration } from 'lib/dateTime'
import {
  BATTLE_LOCKUP,
  BATTLE_STAGE_PLATE,
  battleSingerKeyArt,
  battleSingerOrDefault,
  battleSingerPortrait,
  battleSingerStage,
} from 'lib/battleSingers'
import type { BattleSingerLoop, RosterSinger } from 'lib/battleSingers'
import { POINTS_BATTLE_TAKE_PART, POINTS_BATTLE_WIN } from 'shared/types'
import type { BattleSide, BattleSong, BattleTurn } from 'shared/types'
import styles from './PlayerBattle.css'

/**
 * The eight beats that draw a stage, one component each.
 *
 * They are here rather than in PlayerBattle.tsx so that file stays a
 * switchboard you can read in one screen — which beat is up, which fighter it
 * is about, and the effects that belong to the row rather than to any beat.
 * Everything below is layout and nothing below reaches for the store.
 *
 * Every number in these components is a native design unit multiplied by
 * --px in PlayerBattle.css; see the note at the top of that file. Nothing here
 * sets a size directly, which is what lets the whole stage rescale to any
 * display as one piece.
 *
 * Drawn to Arcade Flow v2's TV screens: 13c versus, 13d/13f ready, 13e/13g
 * the rounds, 13h the vote and 13i the winner.
 */

/** The word art. battleSingers.ts builds the fighters' paths; these three sit
 *  beside the lockup in the same folder and are nobody's but this stage's. */
const WORD_BEGIN = 'assets/battle/word-begin.png'
const WORD_WINS = 'assets/battle/word-wins.png'
const WORD_GAME_OVER = 'assets/battle/word-game-over.png'

/* --- reading a turn --------------------------------------------------- */

const sideClass = (side: BattleSide) => (side === 1 ? styles.sideOne : styles.sideTwo)

const nameOf = (turn: BattleTurn, side: BattleSide) =>
  (side === 1 ? turn.challengerName : turn.opponentName)

const songOf = (turn: BattleTurn, side: BattleSide): BattleSong =>
  (side === 1 ? turn.challengerSong : turn.opponentSong)

/** Who a fighter is singing *as*. The server carries a roster id and nothing
 *  else, so the drawing is looked up here; a battle started before the roster
 *  shipped has no id at all, which battleSingerOrDefault covers. */
const singerOf = (turn: BattleTurn, side: BattleSide): RosterSinger =>
  battleSingerOrDefault(side === 1 ? turn.challengerSingerId : turn.opponentSingerId)

/** The art is drawn facing left for all eight fighters. Side 1 stands on the
 *  left of the stage and looks across, so side 1 is the one that flips. */
const facingOf = (side: BattleSide) => (side === 1 ? 'right' : 'left')

/** Title and artist on one line, the one form every beat shows a song in. */
const songLine = (song: BattleSong) => `${song.title} — ${song.artist}`

const roleOf = (side: BattleSide) => (side === 1 ? 'Singer 1' : 'Singer 2')

/** battleSingerOrDefault never hands back a fighter with no art, so the key
 *  pose always exists and the null the signature allows cannot arrive here. */
const keyArtOf = (singer: RosterSinger) => battleSingerKeyArt(singer)!

/** Who chose the song this fighter has to sing, which is always the other one.
 *  It is the whole shape of the format and the room needs telling. */
const pickedBy = (turn: BattleTurn, side: BattleSide) =>
  `Picked by ${nameOf(turn, side === 1 ? 2 : 1)}`

/** How far through its own beat the clock is, 0 to 1. Taken from the payload's
 *  own two stamps rather than from a BATTLE_*_MS constant, so a singing beat
 *  cut short by the song ending still fills a bar that means something. */
const progress = (turn: BattleTurn, msLeft: number) =>
  1 - msLeft / Math.max(1, turn.endsAt - turn.sentAt)

/** A fighter's own room.
 *
 *  A fighter may ship a `location.png` and most will not, so the 404 is the
 *  ordinary path rather than the error one — the same bargain every portrait
 *  makes, and the dive bar stands in. Keyed on the src so a battle between two
 *  different fighters re-tries rather than inheriting the last one's failure.
 *
 *  No loading state and no async step on purpose. The src is derived from the
 *  fighter's id, which is on the first beat and does not change for the rest
 *  of the fight, so the room at 'logo' is the room at 'winner'. A background
 *  resolved through the fighter listing would draw the dive bar until that
 *  fetch landed and then pop to the art mid-battle. */
export const StagePlate = ({ src, className = styles.plate }: { src: string, className?: string }) => {
  const [isMissing, setIsMissing] = useState(false)

  return (
    <img
      key={src}
      className={className}
      src={isMissing ? BATTLE_STAGE_PLATE : src}
      alt=''
      onError={() => setIsMissing(true)}
    />
  )
}

/** A fighter's portrait chip, ringed in their own colour. */
const Portrait = ({ singer, className }: { singer: RosterSinger, className: string }) => (
  <img className={clsx(styles.chip, className)} src={battleSingerPortrait(singer)} alt='' />
)

/* --- the title card --------------------------------------------------- */

/**
 * The first scene: the lockup on black, and nothing else.
 *
 * Deliberately the emptiest screen in the sequence. It is the only beat with
 * no name, no song and no fighter on it, which is the whole of its job — the
 * room looks up, reads one thing, and the versus card that follows lands on
 * people who are already watching.
 *
 * Three seconds on flat black. Short, because it says one word and a room that
 * has read it is only waiting; black, because the dimmed stage plate behind it
 * made the card read as the opening frame of the versus scene rather than as a
 * title of its own.
 *
 * The lockup is the set's one non-pixel asset and is the only image on this
 * stage told to sample smoothly; `.lockup` carries that, and it is shared with
 * the holding card rather than restated. */
export const Logo = () => (
  <div className={styles.titleCard}>
    <img className={styles.lockup} src={BATTLE_LOCKUP} alt='Singer Battle' />
  </div>
)

/* --- versus ----------------------------------------------------------- */

/** Both fighters' rooms, one each side of a seam. On the versus card (13c)
 *  the seam is a gold diagonal, 58% across the top to 42% across the foot; on
 *  the vote (13h) it is straight down the middle. Both beats that show the
 *  pair show this behind them: it is what says the fight has two sides before
 *  a word of it has been read. */
const SplitField = ({ turn, isStraight }: { turn: BattleTurn, isStraight?: boolean }) => (
  <div className={clsx(styles.field, isStraight && styles.fieldStraight)}>
    <StagePlate src={battleSingerStage(singerOf(turn, 1))} className={styles.wedgeOne} />
    <StagePlate src={battleSingerStage(singerOf(turn, 2))} className={styles.wedgeTwo} />
    {!isStraight && <div className={styles.seam} />}
  </div>
)

/** Both fighters facing each other across the seam of the two colour wedges,
 *  drawn in key art rather than a loop: this beat is a poster, and a card that
 *  holds for five seconds on two idle loops reads as two people waiting. */
const Pair = ({ turn, className }: { turn: BattleTurn, className?: string }) => (
  <>
    {([1, 2] as BattleSide[]).map(side => (
      <BattleLoop
        key={side}
        src={keyArtOf(singerOf(turn, side))}
        facing={facingOf(side)}
        className={clsx(styles.pairSprite, side === 1 ? styles.pairOne : styles.pairTwo, className)}
      />
    ))}
  </>
)

/**
 * The card, which is a scene rather than a still: the pair and the field walk
 * on, hold, and clear the stage again. The timing lives in PlayerBattle.css
 * against BATTLE_VERSUS_MS; all that is decided here is where in it this screen
 * is starting.
 *
 * Read once, on mount, and never again: --t0 is an animation-delay, and an
 * animation-delay that changes restarts the animation it is on — which is every
 * tick of the clock if this is taken from msLeft as it falls. Both stamps are
 * the server's, so two screens joining at different moments still land on the
 * same frame of the same scene.
 */
export const Versus = ({ turn, msLeft }: { turn: BattleTurn, msLeft: number }) => {
  const [elapsedMs] = useState(() => Math.max(0, (turn.endsAt - turn.sentAt) - msLeft))

  return (
    <div className={styles.vsScene} style={{ '--t0': `${-elapsedMs}ms` } as React.CSSProperties}>
      <SplitField turn={turn} />
      <Pair turn={turn} className={styles.pairVersus} />
      <div className={clsx(styles.display, styles.vsWord)}>VS</div>
      <img className={styles.vsBegin} src={WORD_BEGIN} alt='' />
      <div className={styles.vsBand}>
        {([1, 2] as BattleSide[]).map(side => (
          <div
            key={side}
            className={clsx(styles.vsHalf, side === 2 && styles.vsHalfTwo, sideClass(side))}
          >
            <div className={clsx(styles.silk, styles.vsRole)}>{side === 1 ? 'Challenger' : 'Opponent'}</div>
            <div className={clsx(styles.display, styles.vsName, styles.oneLine)} translate='no'>
              {nameOf(turn, side)}
            </div>
            <div className={clsx(styles.vsSong, styles.oneLine)} translate='no'>
              <span className={styles.vsSings}>sings </span>
              {songLine(songOf(turn, side))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* --- intro ------------------------------------------------------------ */

/** 13d/13f: one fighter dancing in their room, and across from them who is
 *  on, what they are singing, and who chose it. Twelve seconds is long enough
 *  that a still pose would read as a frozen screen, so this is the dance loop.
 *  The fighter stands where they will stand to sing, so the handoff into the
 *  song does not move them. */
export const Intro = ({ turn, at }: { turn: BattleTurn, at: BattleSide }) => {
  const singer = singerOf(turn, at)
  const frame = useSpriteFrame(singer, 'dance')
  const song = songOf(turn, at)

  return (
    <div className={sideClass(at)}>
      <div className={clsx(styles.soloField, at === 2 && styles.soloFieldTwo)} />
      <BattleLoop
        src={frame}
        facing={facingOf(at)}
        className={clsx(styles.singSprite, at === 1 ? styles.singSpriteOne : styles.singSpriteTwo)}
      />
      <div className={clsx(styles.introText, at === 2 && styles.introTextTwo)}>
        <div className={clsx(styles.silk, styles.introRole)}>{`${roleOf(at)} · On stage next`}</div>
        <div className={clsx(styles.display, styles.introName)} translate='no'>
          {nameOf(turn, at)}
        </div>
        <div className={styles.introTitle} translate='no'>{song.title}</div>
        <div className={styles.introArtist} translate='no'>{song.artist}</div>
      </div>
      <div className={clsx(styles.introFoot, at === 2 && styles.introTextTwo)}>
        <span className={clsx(styles.silk, styles.roundChip)}>{`Battle · round ${at}`}</span>
        <span className={clsx(styles.silk, styles.pickedBy, sideClass(at === 1 ? 2 : 1))} translate='no'>
          {pickedBy(turn, at)}
        </span>
      </div>
    </div>
  )
}

/* --- singing ---------------------------------------------------------- */

/** One fighter in the singing beats' top bar: their chip and their name,
 *  lit while they sing and dimmed while the other one does (13e/13g). Side 2
 *  reads the other way round, so the two chips sit at the bar's two ends. */
const HudSide = ({ turn, side, isLive }: { turn: BattleTurn, side: BattleSide, isLive: boolean }) => (
  <div className={clsx(styles.hudSide, side === 2 && styles.hudSideTwo, !isLive && styles.hudIdle, sideClass(side))}>
    <Portrait singer={singerOf(turn, side)} className={styles.hudPortrait} />
    <div className={clsx(styles.silk, styles.hudName, styles.oneLine)} translate='no'>
      {nameOf(turn, side)}
    </div>
  </div>
)

/**
 * The busiest beat, and the only one with something behind it: the karaoke
 * player is mounted under this whole component and shows through the panel,
 * which is a hole cut in the stage plate rather than a box the video is put
 * inside.
 *
 * The two singing beats mirror each other. The singer keeps the outer 132 units
 * of the stage and the video takes the rest, so no part of a fighter ever
 * crosses the lyrics.
 */
export const Sing = ({ turn, at, msLeft }: { turn: BattleTurn, at: BattleSide, msLeft: number }) => {
  const singer = singerOf(turn, at)
  const frame = useSpriteFrame(singer, 'sing')

  return (
    <div className={sideClass(at)}>
      <BattleLoop
        src={frame}
        facing={facingOf(at)}
        className={clsx(styles.singSprite, at === 1 ? styles.singSpriteOne : styles.singSpriteTwo)}
      />

      <div className={clsx(styles.panel, at === 1 ? styles.panelOne : styles.panelTwo)}>
        <div className={styles.screen}>
          <div className={styles.live}>
            <div className={styles.liveDot} />
            <div className={clsx(styles.silk, styles.liveLabel)}>Live</div>
          </div>
        </div>
      </div>

      <div className={styles.hud}>
        <HudSide turn={turn} side={1} isLive={at === 1} />
        <div className={styles.hudSong}>
          <div className={clsx(styles.silk, styles.hudRound)}>{`Battle · round ${at} of 2`}</div>
          <div className={clsx(styles.hudTitle, styles.oneLine)} translate='no'>
            {`${songLine(songOf(turn, at))} · ${pickedBy(turn, at).toLowerCase()}`}
          </div>
        </div>
        <HudSide turn={turn} side={2} isLive={at === 2} />
        {/* A two-minute cut counted in bare seconds opens at 120, which reads
            as a score rather than as a clock. formatDuration is what every
            other length in the app is set in. */}
        <div className={clsx(styles.silk, styles.hudClock)}>{formatDuration(Math.ceil(msLeft / 1000))}</div>
      </div>

      <div className={styles.songBar}>
        <div
          className={styles.songFill}
          style={{ width: `${(progress(turn, msLeft) * 100).toFixed(1)}%` }}
        />
      </div>
    </div>
  )
}

/* --- judging ---------------------------------------------------------- */

/** The two keys a voter presses, named, across the foot of the vote (13h):
 *  side one's chip on the far left, side two's on the far right, the names
 *  reading inward toward each other. */
const VoteCards = ({ turn }: { turn: BattleTurn }) => (
  <div className={styles.ballotCards}>
    {([1, 2] as BattleSide[]).map(side => (
      <div
        key={side}
        className={clsx(styles.ballotCard, side === 2 && styles.ballotCardTwo, sideClass(side))}
      >
        <div className={clsx(styles.silk, styles.ballotPress)}>{`Press ${side}`}</div>
        <div className={clsx(styles.silk, styles.ballotName, styles.oneLine)} translate='no'>
          {nameOf(turn, side)}
        </div>
      </div>
    ))}
  </div>
)

/**
 * One cell per phone in the room, filling as the votes land, and the count
 * under it.
 *
 * Every filled cell looks identical regardless of which way it voted, and that
 * is the entire design rather than a simplification. A room that cannot see
 * voting happening decides the feature is broken and stops; a room that can see
 * who is ahead stops voting on who sang and starts voting with the crowd, and
 * the late half of the room decides the fight. One number for the whole room is
 * the only arrangement that avoids both, which is why the server sends the TV a
 * count and never a split — see the note on BattleTurn.ballotsIn.
 *
 * A room of two is a room with nobody to poll. The row and the count come off
 * rather than reading "0 OF 0 IN", which looks like a fault in the count.
 */
const BallotRow = ({ turn }: { turn: BattleTurn }) => {
  if (!turn.ballotsOf) return null

  return (
    <>
      <div className={styles.ballotRow}>
        {Array.from({ length: turn.ballotsOf }, (_, i) => (
          <div
            key={i}
            className={clsx(styles.ballotCell, i < turn.ballotsIn && styles.ballotCellIn)}
          />
        ))}
      </div>
      <div className={styles.ballotCount}>{`${turn.ballotsIn} of ${turn.ballotsOf} in`}</div>
    </>
  )
}

/**
 * The ask, and on the ballot path the vote itself.
 *
 * There is no separate ballot beat: asking the room and counting the room are
 * one screen, because a vote has nothing to look at while it happens. Under
 * crowd scoring this is five seconds of the question and the two metering beats
 * follow; under a silent ballot it is the whole thirty seconds.
 *
 * The ballot half shows how many have voted and never which way — see
 * BallotRow, where the reasoning lives.
 */
export const Judge = ({ turn, msLeft }: { turn: BattleTurn, msLeft: number }) => {
  const isBallot = turn.judging === 'ballot'
  const secs = Math.ceil(msLeft / 1000)

  return (
    <>
      <SplitField turn={turn} isStraight />
      {/* Under the scrim on the crowd path and over it on the ballot. On the
          crowd path the ask is the whole screen and the two of them are
          scenery behind it; on the ballot they are the thing being chosen
          between, so they stand in front of the vote chrome and are lit for
          it. Same two fighters, two different jobs. */}
      <Pair
        turn={turn}
        className={clsx(styles.judgeSprite, isBallot && styles.judgeSpriteLit)}
      />
      <div className={styles.scrim} />
      <div className={styles.judgeHead}>
        <div className={clsx(styles.display, styles.judgeWord)}>Who wins?</div>
        <div className={clsx(styles.silk, styles.judgeLede)}>
          {isBallot ? 'Silent ballot' : 'The room decides'}
        </div>
        {isBallot && <div className={styles.judgeClock}>{formatDuration(secs)}</div>}
      </div>

      {isBallot && (
        <>
          <div className={styles.ballot}>
            <BallotRow turn={turn} />
            <div className={clsx(styles.silk, styles.sealed, !turn.ballotsOf && styles.sealedAlone)}>
              Sealed until time · Nobody sees the split
            </div>
            <div className={styles.ballotBar}>
              <div
                className={styles.ballotBarFill}
                style={{ width: `${Math.round((1 - progress(turn, msLeft)) * 100)}%` }}
              />
            </div>
            <div className={clsx(styles.silk, styles.ballotCloses)}>{`Ballot closes in ${secs}s`}</div>
          </div>
          <VoteCards turn={turn} />
        </>
      )}

      <div className={clsx(styles.silk, styles.judgeBand)}>
        {isBallot
          ? 'One vote each · Anonymous · No takebacks'
          : 'Get loud for the one you liked'}
      </div>
    </>
  )
}

/* --- the crowd meter -------------------------------------------------- */

const CELLS = 24

/** Where a cell sits on the scale decides its colour, not how loud the room
 *  is: the top four are gold and the four below them amber on every beat, so
 *  the same shout looks the same for both fighters. Below that it is the
 *  fighter's own colour, which is what makes a glance tell you who is being
 *  measured without reading the name. */
const cellFill = (i: number, level: number, side: BattleSide) => {
  if (i >= Math.round(level * CELLS)) return 'var(--arc-surface-hover)'
  if (i > 19) return 'var(--arc-gold)'
  if (i > 14) return 'var(--arc-amber)'

  return side === 1 ? 'var(--arc-red)' : 'var(--arc-green)'
}

/** The room being measured for one fighter, on the crowd-scoring path only.
 *
 *  The bar is the microphone right now and the big number is the grade so far,
 *  graded exactly the way the final one will be — so the room is looking at the
 *  number it is about to be judged on rather than at a bar with no arithmetic
 *  behind it. It can fall as well as rise; see crowdScore. */
export const Meter = ({ turn, at, level, grade, msLeft }: {
  turn: BattleTurn
  at: BattleSide
  level: number
  grade: number
  msLeft: number
}) => {
  const singer = singerOf(turn, at)
  const frame = useSpriteFrame(singer, 'dance')

  return (
    <div className={sideClass(at)}>
      <div className={styles.soloField} />
      <BattleLoop
        src={frame}
        facing={facingOf(at)}
        className={clsx(styles.meterSprite, at === 1 ? styles.meterSpriteOne : styles.meterSpriteTwo)}
      />

      <div className={styles.meterHead}>
        <Portrait singer={singer} className={styles.meterPortrait} />
        <div className={styles.meterWho}>
          <div className={clsx(styles.silk, styles.meterCheer)}>Cheer for</div>
          <div className={clsx(styles.display, styles.meterName, styles.oneLine)} translate='no'>
            {nameOf(turn, at)}
          </div>
        </div>
        <div className={styles.meterClock}>{Math.ceil(msLeft / 1000)}</div>
      </div>

      {/* A meter rather than a progressbar: this is a live reading that goes
          down as well as up, and a screen reader announcing a cheering room as
          a task making progress is nonsense. */}
      <div
        className={styles.meterBar}
        role='meter'
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={grade}
        aria-label={`How loud the room is for ${nameOf(turn, at)}`}
      >
        {Array.from({ length: CELLS }, (_, i) => (
          <div key={i} className={styles.meterCell} style={{ background: cellFill(i, level, at) }} />
        ))}
      </div>

      <div className={clsx(styles.silk, styles.meterScale)}>
        <div>0</div>
        <div className={styles.meterMic}>Onboard mic listening</div>
        <div>100</div>
      </div>

      <div className={styles.meterRead}>
        <div className={styles.meterNow}>{String(grade).padStart(2, '0')}</div>
        <div className={clsx(styles.silk, styles.meterFoot)}>Peak held · 0–100 grade</div>
      </div>
    </div>
  )
}

/* --- the verdict ------------------------------------------------------ */

/** What sits between the two scores. A draw has no margin worth printing, and
 *  a battle nobody could hear needs saying out loud — otherwise 0 against 0
 *  looks like two singers the room hated rather than a player with no
 *  microphone. */
const marginLine = (turn: BattleTurn) => {
  if (turn.judging === 'none') return 'No microphone on this player'
  if (turn.challengerScore === turn.opponentScore) return 'Dead heat'

  return `By ${Math.abs(turn.challengerScore - turn.opponentScore)}`
}

/** What a side takes home from the fight, in the server's own numbers: the
 *  win alone to the winner, the part to the loser and to both on a draw. */
const pointsOf = (turn: BattleTurn, side: BattleSide) => {
  const mine = side === 1 ? turn.challengerScore : turn.opponentScore
  const theirs = side === 1 ? turn.opponentScore : turn.challengerScore

  return mine > theirs ? POINTS_BATTLE_WIN : POINTS_BATTLE_TAKE_PART
}

/** One fighter's card at the head of the verdict (13i): their chip and name
 *  in their colour, the score, and the points it earned bursting in. Side 2's
 *  is mirrored so the two cards read outward from the middle. */
const Score = ({ turn, side }: { turn: BattleTurn, side: BattleSide }) => (
  <div className={clsx(styles.winSide, side === 2 && styles.winSideTwo, sideClass(side))}>
    <Portrait singer={singerOf(turn, side)} className={styles.winPortrait} />
    <div className={clsx(styles.silk, styles.winSideName, styles.oneLine)} translate='no'>
      {nameOf(turn, side)}
    </div>
    {/* Zero-padded, which is arcade for "this is a score out of a hundred"
        and keeps the two numbers the same width so the card does not shift
        when one of them crosses ten. */}
    <div className={clsx(styles.silk, styles.winScore)}>
      {String(side === 1 ? turn.challengerScore : turn.opponentScore).padStart(2, '0')}
    </div>
    <div className={clsx(styles.silk, styles.winPts, side === 2 && styles.winPtsLate)}>
      {`+${pointsOf(turn, side)}`}
    </div>
  </div>
)

/** The singer the room goes back to when the fight is over.
 *
 *  Null at the end of the queue, and for a row that is not an ordinary song —
 *  a trivia round draws its own mark and a second battle opens by naming both
 *  of its own fighters, so neither wants announcing from inside this one. */
export interface BattleUpNext {
  singer: string
  songTitle?: string
  songArtist?: string
}

/** One of the two fighters as the lights come up.
 *
 *  A component rather than two useSpriteFrame calls inside Winner because the
 *  set differs per side, and a hook cannot be called from a map.
 *
 *  Both one-shots are played from how far into the beat the room is, so the
 *  knockdown and the celebration land together on every screen and neither
 *  replays if a display remounts halfway through the verdict. */
const WinFighter = ({ turn, at, set, elapsedMs, isRaised }: {
  turn: BattleTurn
  at: BattleSide
  set: BattleSingerLoop
  elapsedMs: number
  isRaised?: boolean
}) => {
  const frame = useSpriteFrame(singerOf(turn, at), set, elapsedMs)

  return (
    <BattleLoop
      src={frame}
      facing={facingOf(at)}
      className={clsx(
        styles.winSprite,
        at === 1 ? styles.winSpriteOne : styles.winSpriteTwo,
        isRaised && styles.winSpriteRaised,
      )}
    />
  )
}

export const Winner = ({ turn, msLeft, upNext }: {
  turn: BattleTurn
  msLeft: number
  upNext?: BattleUpNext | null
}) => {
  const isDraw = turn.challengerScore === turn.opponentScore
  const at: BattleSide = turn.challengerScore > turn.opponentScore ? 1 : 2
  // Both stamps are the server's, so their difference is the beat's true
  // length whatever this box's clock says; msLeft has already been through
  // serverNow. The pair is what makes this the one figure the whole room
  // agrees on.
  const elapsedMs = (turn.endsAt - turn.sentAt) - msLeft
  // The word art and the points are CSS animations played from where in the
  // beat this screen joined. Read once: an animation-delay that changes
  // restarts its animation, which would be every tick of the clock.
  const [t0] = useState(() => -Math.max(0, elapsedMs))

  /** The winner celebrates and the loser goes down. On a draw nobody won, so
   *  nobody gets the victory: both take the knockdown, which is the only pair
   *  of poses that does not name one of them the winner. */
  const setFor = (side: BattleSide): BattleSingerLoop =>
    (!isDraw && side === at ? 'victory' : 'ko')

  return (
    <div className={styles.winScene} style={{ '--t0': `${t0}ms` } as React.CSSProperties}>
      <div className={styles.winScrim} />
      {([1, 2] as BattleSide[]).map(side => (
        <WinFighter
          key={side}
          turn={turn}
          at={side}
          set={setFor(side)}
          elapsedMs={elapsedMs}
          isRaised={!!upNext}
        />
      ))}
      <div className={styles.winCards}>
        <Score turn={turn} side={1} />
        <Score turn={turn} side={2} />
      </div>
      <div className={clsx(styles.silk, styles.winMargin)}>{marginLine(turn)}</div>
      {isDraw
        ? (
            <div className={styles.winHead}>
              <div className={clsx(styles.display, styles.winName)}>Draw</div>
              <div className={clsx(styles.display, styles.winVerb)}>Nobody wins</div>
            </div>
          )
        : (
            // WINS, dropped in under the winner's own card.
            <img
              className={clsx(styles.winWord, at === 1 ? styles.winWordOne : styles.winWordTwo)}
              src={WORD_WINS}
              alt='Takes it'
            />
          )}
      <img className={styles.gameOver} src={WORD_GAME_OVER} alt='' />
      {/* The handover, on the one beat with room for it.
          The page that normally names the next singer is stood down before a
          battle — it can only name one of two fighters — so the fifteen
          seconds of the verdict carries it instead, and the room never loses
          the thread of whose turn is next. A strip rather than a screen of its
          own: nobody should wait longer to sing because two other people
          just did. */}
      {upNext && (
        <div className={styles.winNext}>
          <span className={clsx(styles.silk, styles.winNextLabel)}>Up next</span>
          <span className={clsx(styles.display, styles.winNextName, styles.oneLine)} translate='no'>
            {upNext.singer}
          </span>
          {upNext.songTitle && (
            <span className={clsx(styles.winNextSong, styles.oneLine)} translate='no'>
              {upNext.songArtist ? `${upNext.songTitle} — ${upNext.songArtist}` : upNext.songTitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
