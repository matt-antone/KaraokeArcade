import React from 'react'
import clsx from 'clsx'
import BattleLoop from './BattleLoop'
import useSpriteFrame from './useSpriteFrame'
import { formatDuration } from 'lib/dateTime'
import {
  battleSingerKeyArt,
  battleSingerOrDefault,
  battleSingerPortrait,
} from 'lib/battleSingers'
import type { BattleSingerLoop, RosterSinger } from 'lib/battleSingers'
import type { BattleSide, BattleSong, BattleTurn } from 'shared/types'
import styles from './PlayerBattle.css'

/**
 * The seven beats that draw a stage, one component each.
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
 */

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

/** Title and artist on one line, in the mono face every other number and song
 *  title in this feature is set in. */
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

/** A fighter's portrait chip, ringed in their own colour. */
const Portrait = ({ singer, className }: { singer: RosterSinger, className: string }) => (
  <img className={clsx(styles.chip, className)} src={battleSingerPortrait(singer)} alt='' />
)

/* --- versus ----------------------------------------------------------- */

/** The two colour wedges, meeting at a diagonal over the middle of the stage.
 *  Both beats that show the pair show this behind them: it is what says the
 *  fight has two sides before a word of it has been read. */
const SplitField = () => (
  <div className={styles.field}>
    <div className={styles.wedgeOne} />
    <div className={styles.wedgeTwo} />
  </div>
)

/** Both fighters facing each other across the seam of the two colour wedges,
 *  drawn in key art rather than a loop: this beat is a poster, and five
 *  seconds of two idle loops reads as two people waiting. */
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

export const Versus = ({ turn }: { turn: BattleTurn }) => (
  <>
    <SplitField />
    <Pair turn={turn} />
    <div className={clsx(styles.display, styles.vsWord)}>VS</div>
    <div className={styles.vsBand}>
      {([1, 2] as BattleSide[]).map(side => (
        <div
          key={side}
          className={clsx(styles.vsHalf, side === 2 && styles.vsHalfTwo, sideClass(side))}
        >
          <div className={clsx(styles.display, styles.vsName, styles.oneLine)} translate='no'>
            {nameOf(turn, side)}
          </div>
          <div className={clsx(styles.silk, styles.vsSings)}>Sings</div>
          <div className={clsx(styles.vsSong, styles.oneLine)} translate='no'>
            {songLine(songOf(turn, side))}
          </div>
        </div>
      ))}
    </div>
  </>
)

/* --- intro ------------------------------------------------------------ */

/** One fighter alone in a spotlight, with the song the other one picked for
 *  them. Twelve seconds is long enough that a still pose would read as a
 *  frozen screen, so this is the dance loop. */
export const Intro = ({ turn, at }: { turn: BattleTurn, at: BattleSide }) => {
  const singer = singerOf(turn, at)
  const frame = useSpriteFrame(singer, 'dance')

  return (
    <div className={sideClass(at)}>
      <div className={styles.soloField} />
      <div className={styles.introPlate}>
        <div className={clsx(styles.silk, styles.introRole)}>{roleOf(at)}</div>
        <div className={clsx(styles.display, styles.introName)} translate='no'>
          {nameOf(turn, at)}
        </div>
      </div>
      <BattleLoop
        src={frame}
        facing={facingOf(at)}
        className={styles.introSprite}
      />
      <div className={styles.introSong}>
        <div className={clsx(styles.silk, styles.pickedBy)} translate='no'>{pickedBy(turn, at)}</div>
        <div className={clsx(styles.songTitle, styles.oneLine)} translate='no'>
          {songLine(songOf(turn, at))}
        </div>
      </div>
    </div>
  )
}

/* --- singing ---------------------------------------------------------- */

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
        <div className={styles.hudWho}>
          <Portrait singer={singer} className={styles.hudPortrait} />
          <div className={styles.oneLine}>
            <div className={clsx(styles.display, styles.hudName, styles.oneLine)} translate='no'>
              {nameOf(turn, at)}
            </div>
            <div className={clsx(styles.silk, styles.hudRole)}>
              {roleOf(at)}
              {' · On stage'}
            </div>
          </div>
        </div>
        <div className={styles.hudSong}>
          <div className={clsx(styles.silk, styles.pickedBy)} translate='no'>{pickedBy(turn, at)}</div>
          <div className={clsx(styles.songTitle, styles.oneLine)} translate='no'>
            {songLine(songOf(turn, at))}
          </div>
        </div>
        <div className={styles.hudClock}>
          {/* A two-minute cut counted in bare seconds opens at 120, which reads
              as a score rather than as a clock. formatDuration is what every
              other length in the app is set in. */}
          <div className={styles.clockBig}>{formatDuration(Math.ceil(msLeft / 1000))}</div>
          <div className={clsx(styles.silk, styles.hudCut)}>Two minute cut</div>
        </div>
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

/** The two keys a voter presses, named. Left card is right-aligned and right
 *  card left-aligned, so the two names sit as close together as the layout
 *  allows — they are one choice, not two panels. */
const VoteCards = ({ turn }: { turn: BattleTurn }) => (
  <div className={styles.ballotCards}>
    {([1, 2] as BattleSide[]).map(side => (
      <div
        key={side}
        className={clsx(styles.ballotCard, side === 2 && styles.ballotCardTwo, sideClass(side))}
      >
        <div className={clsx(styles.silk, styles.ballotPress)}>{`Press ${side}`}</div>
        <div className={clsx(styles.display, styles.ballotName, styles.oneLine)} translate='no'>
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
      <SplitField />
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
      </div>

      {isBallot && (
        <>
          <div className={styles.judgeClock}>{secs}</div>
          <div className={styles.ballot}>
            <VoteCards turn={turn} />
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
 *  is: the top four are amber and the four below them orange on every beat, so
 *  the same shout looks the same for both fighters. Below that it is the
 *  fighter's own colour, which is what makes a glance tell you who is being
 *  measured without reading the name. */
const cellFill = (i: number, level: number, side: BattleSide) => {
  if (i >= Math.round(level * CELLS)) return '#222528'
  if (i > 19) return '#ffd166'
  if (i > 14) return '#ff8a1e'

  return side === 1 ? '#c01723' : '#0d7039'
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

/** One fighter's half of the score band. Side 2's is reversed and right-set so
 *  the two blocks read outward from the margin between them, rather than both
 *  starting at the left and leaving the room to work out which score is whose. */
const Score = ({ turn, side }: { turn: BattleTurn, side: BattleSide }) => (
  <div className={clsx(styles.winSide, side === 2 && styles.winSideTwo, sideClass(side))}>
    <Portrait singer={singerOf(turn, side)} className={styles.winPortrait} />
    <div className={styles.oneLine}>
      <div className={clsx(styles.silk, styles.winSideName, styles.oneLine)} translate='no'>
        {nameOf(turn, side)}
      </div>
      {/* Zero-padded, which is arcade for "this is a score out of a hundred"
          and keeps the two numbers the same width so the band does not shift
          when one of them crosses ten. */}
      <div className={styles.winScore}>
        {String(side === 1 ? turn.challengerScore : turn.opponentScore).padStart(2, '0')}
      </div>
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

  /** The winner celebrates and the loser goes down. On a draw nobody won, so
   *  nobody gets the victory: both take the knockdown, which is the only pair
   *  of poses that does not name one of them the winner. */
  const setFor = (side: BattleSide): BattleSingerLoop =>
    (!isDraw && side === at ? 'victory' : 'ko')

  return (
    <>
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
      <div className={styles.winHead}>
        <div className={clsx(styles.display, styles.winName)} translate='no'>
          {isDraw ? 'Draw' : nameOf(turn, at)}
        </div>
        <div className={clsx(styles.display, styles.winVerb)}>
          {isDraw ? 'Nobody wins' : 'Takes it'}
        </div>
      </div>
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
      <div className={styles.winBand}>
        <Score turn={turn} side={1} />
        <div className={clsx(styles.silk, styles.winMargin)}>{marginLine(turn)}</div>
        <Score turn={turn} side={2} />
      </div>
    </>
  )
}
