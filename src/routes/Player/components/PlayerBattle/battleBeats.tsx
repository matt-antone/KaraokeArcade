import React, { useState } from 'react'
import clsx from 'clsx'
import { SpriteBox } from 'components/SpriteLoop/SpriteLoop'
import CountUp from 'components/CountUp/CountUp'
import WordArt from 'components/WordArt/WordArt'
import useSpriteFrame from 'lib/useSpriteFrame'
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
 * The beats that draw a stage, one component each.
 *
 * They are here rather than in PlayerBattle.tsx so that file stays a
 * switchboard you can read in one screen — which beat is up, which fighter it
 * is about, and the effects that belong to the row rather than to any beat.
 * Everything below is layout and nothing below reaches for the store.
 *
 * Every number in these components is a native design unit multiplied by
 * --px in PlayerBattle.css; see the note at the top of that file.
 *
 * Drawn to Arcade Flow v2's TV screens: 13c versus, 13d/13f ready, 13e/13g
 * the rounds, 13h the vote and 13i the winner.
 */

/** One design px in stage units: the design is 960 wide, the stage 384. The
 *  word art's keyframe offsets are written in design px and read this. */
const WORD_ART_UNIT = { '--wa-u': 'calc(0.4 * var(--px))' } as React.CSSProperties

/** The KaraokeArcade mark the TV screens carry in a top corner. */
const LOGO = 'assets/arcade/logo.svg'

/** 13c's "Get ready" starts 3.2s into the scene and counts 05 to 01 a second
 *  apiece; BEGIN slams at 8.2s. BATTLE_VERSUS_MS is set to hold it. */
const COUNT_FROM_MS = 3200

/** 13i's knockdown waits this long before it falls. */
const KO_DELAY_MS = 600

/* --- reading a turn --------------------------------------------------- */

const sideClass = (side: BattleSide) => (side === 1 ? styles.sideOne : styles.sideTwo)

const nameOf = (turn: BattleTurn, side: BattleSide) =>
  (side === 1 ? turn.challengerName : turn.opponentName)

const songOf = (turn: BattleTurn, side: BattleSide): BattleSong =>
  (side === 1 ? turn.challengerSong : turn.opponentSong)

const scoreOf = (turn: BattleTurn, side: BattleSide) =>
  (side === 1 ? turn.challengerScore : turn.opponentScore)

/** Who a fighter is singing *as*. The server carries a roster id and nothing
 *  else, so the drawing is looked up here; a battle started before the roster
 *  shipped has no id at all, which battleSingerOrDefault covers. */
const singerOf = (turn: BattleTurn, side: BattleSide): RosterSinger =>
  battleSingerOrDefault(side === 1 ? turn.challengerSingerId : turn.opponentSingerId)

/** The art is drawn facing left for all eight fighters. Side 1 stands on the
 *  left of the stage and looks across, so side 1 is the one that flips. */
const facingOf = (side: BattleSide) => (side === 1 ? 'right' : 'left')

/** Who chose the song this fighter has to sing, which is always the other one.
 *  It is the whole shape of the format and the room needs telling. */
const pickedBy = (turn: BattleTurn, side: BattleSide) =>
  `Picked by ${nameOf(turn, side === 1 ? 2 : 1)}`

/** A fighter's own room.
 *
 *  A fighter may ship a `location.png` and most will not, so the 404 is the
 *  ordinary path rather than the error one, and the dive bar stands in. Keyed
 *  on the src so a battle between two different fighters re-tries rather than
 *  inheriting the last one's failure. */
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
  <img className={clsx(styles.chip, className)} src={battleSingerPortrait(singer, 80)} alt='' />
)

/** The KaraokeArcade mark in a top corner (13d, 13f, 13h, 13i). */
const Brand = ({ className }: { className: string }) => (
  <img className={clsx(styles.brand, className)} src={LOGO} alt='KaraokeArcade' />
)

/** The venue in the other top corner (13d, 13f, 13h). */
const Venue = ({ venue, className }: { venue?: string, className: string }) => (
  venue ? <div className={clsx(styles.silk, styles.venue, className)} translate='no'>{venue}</div> : null
)

/** Both fighters' rooms, one each side of a seam: a gold diagonal from 58%
 *  across the top to 42% across the foot on the versus (13c), straight down
 *  the middle on the vote (13h). */
const SplitField = ({ turn, isStraight }: { turn: BattleTurn, isStraight?: boolean }) => (
  <div className={clsx(styles.field, isStraight && styles.fieldStraight)}>
    <StagePlate src={battleSingerStage(singerOf(turn, 1))} className={styles.wedgeOne} />
    <StagePlate src={battleSingerStage(singerOf(turn, 2))} className={styles.wedgeTwo} />
  </div>
)

/** Both fighters in key art. On the versus they face each other across the
 *  seam; on the vote they face out, toward the room deciding between them. */
const Pair = ({ turn, isOutward, className }: { turn: BattleTurn, isOutward?: boolean, className: string }) => (
  <>
    {([1, 2] as BattleSide[]).map(side => (
      <SpriteBox
        key={side}
        src={battleSingerKeyArt(singerOf(turn, side))}
        facing={isOutward ? facingOf(side === 1 ? 2 : 1) : facingOf(side)}
        className={clsx(className, side === 1 ? styles.pairOne : styles.pairTwo)}
      />
    ))}
  </>
)

/* --- versus (13c) ------------------------------------------------------ */

/**
 * One scene of about nine seconds: the lockup clears over the first two, VS
 * lands at 1.9s and stays, "Get ready" counts 05 to 01 from 3.2s, and BEGIN
 * slams at 8.2s.
 *
 * --t0 is how far into the beat this screen joined, read once on mount: it is
 * an animation-delay, and an animation-delay that changes restarts its
 * animation. The count is read off the clock on every tick instead, so a
 * screen that joins late lands on the right number.
 */
export const Versus = ({ turn, msLeft }: { turn: BattleTurn, msLeft: number }) => {
  const elapsedMs = Math.max(0, (turn.endsAt - turn.sentAt) - msLeft)
  const [t0] = useState(() => -elapsedMs)
  const count = elapsedMs < COUNT_FROM_MS ? null : Math.max(0, 5 - Math.floor((elapsedMs - COUNT_FROM_MS) / 1000))

  return (
    <div className={styles.vsScene} style={{ '--t0': `${t0}ms` } as React.CSSProperties}>
      <SplitField turn={turn} />
      <div className={styles.vsWash} />
      <div className={styles.seam} />
      <Pair turn={turn} className={styles.pairVersus} />

      {([1, 2] as BattleSide[]).map(side => (
        <div key={side} className={clsx(styles.vsCard, side === 2 && styles.vsCardTwo, sideClass(side))}>
          <div className={clsx(styles.silk, styles.vsRole)}>{side === 1 ? 'Challenger' : 'Opponent'}</div>
          <div className={clsx(styles.silk, styles.vsName, styles.oneLine)} translate='no'>
            {nameOf(turn, side)}
          </div>
          <div className={clsx(styles.vsSong, styles.oneLine)} translate='no'>
            {`sings ${songOf(turn, side).title}`}
          </div>
        </div>
      ))}

      <div className={styles.vsRow}>
        <span className={clsx(styles.display, styles.vsWord)}>VS</span>
      </div>

      <div className={styles.countRow}>
        {count === 0 && (
          <WordArt
            kind='begin'
            width='calc(208 * var(--px))'
            style={{ ...WORD_ART_UNIT, marginTop: 'calc(-4 * var(--px))' }}
          />
        )}
        {!!count && (
          <div className={clsx(styles.countdown, count <= 3 && styles.countdownHot)}>
            <span className={clsx(styles.silk, styles.getReady)}>Get ready</span>
            <span className={clsx(styles.display, styles.countNum)}>{String(count).padStart(2, '0')}</span>
          </div>
        )}
      </div>

      <img className={styles.logoOut} src={BATTLE_LOCKUP} alt='Singer Battle 1v1' />
    </div>
  )
}

/* --- ready (13d / 13f) -------------------------------------------------- */

/** One fighter dancing in their own room, and across from them who is on,
 *  what they are singing, and who chose it. Side 2 mirrors the whole card. */
export const Intro = ({ turn, at, venue }: { turn: BattleTurn, at: BattleSide, venue?: string }) => {
  const frame = useSpriteFrame(singerOf(turn, at), 'dance')
  const song = songOf(turn, at)

  return (
    <div className={sideClass(at)}>
      <div className={clsx(styles.soloField, at === 2 && styles.soloFieldTwo)} />
      <SpriteBox
        src={frame}
        facing={facingOf(at)}
        className={clsx(styles.readySprite, at === 1 ? styles.readySpriteOne : styles.readySpriteTwo)}
      />
      <Brand className={at === 1 ? styles.brandLeft : styles.brandRight} />
      <Venue venue={venue} className={at === 1 ? styles.venueRight : styles.venueLeft} />
      <div className={clsx(styles.introText, at === 2 && styles.introTextTwo)}>
        <div className={clsx(styles.silk, styles.introRole)}>On stage next</div>
        <div className={clsx(styles.silk, styles.introName)} translate='no'>{nameOf(turn, at)}</div>
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

/* --- singing (13e / 13g) ------------------------------------------------ */

/** One fighter at an end of the top bar: chip and name, dimmed while the
 *  other one sings. Side 2 reads the other way round. */
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
 * inside. The panel is only a bezel, drawn around the hole.
 */
export const Sing = ({ turn, at, msLeft, isBezeled = true }: {
  turn: BattleTurn
  at: BattleSide
  msLeft: number
  /** off for a keyed half: its lyrics stand on the fighter's stage unframed */
  isBezeled?: boolean
}) => {
  const frame = useSpriteFrame(singerOf(turn, at), 'sing')

  return (
    <div className={sideClass(at)}>
      <SpriteBox
        src={frame}
        facing={facingOf(at)}
        className={clsx(styles.singSprite, at === 1 ? styles.singSpriteOne : styles.singSpriteTwo)}
      />

      {isBezeled && <div className={clsx(styles.panel, at === 1 ? styles.panelOne : styles.panelTwo)} />}

      <div className={styles.hud}>
        <HudSide turn={turn} side={1} isLive={at === 1} />
        <div className={styles.hudSong}>
          <div className={clsx(styles.silk, styles.hudRound)}>{`Battle · round ${at} of 2`}</div>
          <div className={clsx(styles.hudTitle, styles.oneLine)} translate='no'>
            {`${songOf(turn, at).title} · picked by ${nameOf(turn, at === 1 ? 2 : 1)}`}
          </div>
        </div>
        <HudSide turn={turn} side={2} isLive={at === 2} />
        <div className={clsx(styles.silk, styles.hudClock)}>{formatDuration(Math.ceil(msLeft / 1000))}</div>
      </div>
    </div>
  )
}

/* --- judging (13h) ------------------------------------------------------ */

/** The live split across the foot of the vote: each side's chip, name and
 *  count, and the bar filling from both ends as the room votes. */
const VoteSplit = ({ turn }: { turn: BattleTurn }) => {
  const room = Math.max(1, turn.ballotsOf)
  const votes = { 1: turn.challengerVotes, 2: turn.opponentVotes }

  return (
    <div className={styles.voteFoot}>
      <div className={styles.voteRow}>
        {([1, 2] as BattleSide[]).map(side => (
          <div key={side} className={clsx(styles.voteSide, side === 2 && styles.voteSideTwo, sideClass(side))}>
            <span className={clsx(styles.silk, styles.voteChip)}>{`P${side}`}</span>
            <span className={clsx(styles.silk, styles.voteName, styles.oneLine)} translate='no'>{nameOf(turn, side)}</span>
            <span className={clsx(styles.silk, styles.voteCount)}>{votes[side]}</span>
          </div>
        ))}
      </div>
      <div className={styles.voteBar}>
        {([1, 2] as BattleSide[]).map(side => (
          <div
            key={side}
            className={clsx(styles.voteFill, sideClass(side))}
            style={{ width: `${Math.min(1, votes[side] / room) * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * The ask, and on the ballot path the vote itself: VOTE NOW, the clock, and
 * the split filling as the room votes (U-13).
 *
 * The crowd path (U-26) is not designed and is drawn in the same vocabulary:
 * the ask, and the call to make some noise where the split would be. Nobody
 * is named: the room has just heard them both.
 */
export const Judge = ({ turn, msLeft, venue }: { turn: BattleTurn, msLeft: number, venue?: string }) => {
  const isBallot = turn.judging === 'ballot'

  return (
    <>
      <SplitField turn={turn} isStraight />
      <div className={styles.voteWash} />
      <Pair turn={turn} isOutward className={styles.judgeSprite} />
      <Brand className={clsx(styles.brandLeft, styles.brandSmall)} />
      <Venue venue={venue} className={clsx(styles.venueRight, styles.venueTight)} />

      <div className={styles.judgeHead}>
        <div className={clsx(styles.display, styles.judgeWord)}>{isBallot ? 'VOTE NOW' : 'Who wins?'}</div>
        <div className={clsx(styles.silk, styles.judgeLede)}>{isBallot ? 'on your phone' : 'The room decides'}</div>
        {isBallot && (
          <div className={clsx(styles.silk, styles.judgeClock)}>{formatDuration(Math.ceil(msLeft / 1000))}</div>
        )}
      </div>

      {isBallot
        ? <VoteSplit turn={turn} />
        : <div className={clsx(styles.silk, styles.judgeCall)}>Get loud for the one you liked</div>}
    </>
  )
}

/* --- the crowd meter -------------------------------------------------- */

const CELLS = 24

/** Where a cell sits on the scale decides its colour, not how loud the room
 *  is: the top four are gold and the four below them amber on every beat, so
 *  the same shout looks the same for both fighters. Below that it is the
 *  fighter's own colour. */
const cellFill = (i: number, level: number, side: BattleSide) => {
  if (i >= Math.round(level * CELLS)) return 'var(--arc-surface-hover)'
  if (i > 19) return 'var(--arc-gold)'
  if (i > 14) return 'var(--arc-amber)'

  return side === 1 ? 'var(--arc-red)' : 'var(--arc-green)'
}

/** The room being measured for one fighter, on the crowd-scoring path only
 *  (U-26: undesigned, kept). The bar is the microphone right now and the big
 *  number is the grade so far, graded exactly the way the final one will be.
 *  It can fall as well as rise; see crowdScore. */
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
      <SpriteBox
        src={frame}
        facing={facingOf(at)}
        className={clsx(styles.meterSprite, at === 1 ? styles.meterSpriteOne : styles.meterSpriteTwo)}
      />

      <div className={styles.meterHead}>
        <Portrait singer={singer} className={styles.meterPortrait} />
        <div className={styles.meterWho}>
          <div className={clsx(styles.silk, styles.meterCheer)}>Cheer for</div>
          <div className={clsx(styles.silk, styles.meterName, styles.oneLine)} translate='no'>
            {nameOf(turn, at)}
          </div>
        </div>
        <div className={clsx(styles.silk, styles.meterClock)}>{Math.ceil(msLeft / 1000)}</div>
      </div>

      {/* A meter rather than a progressbar: this is a live reading that goes
          down as well as up. */}
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
        <div className={clsx(styles.display, styles.meterNow)}>{grade}</div>
        <div className={clsx(styles.silk, styles.meterFoot)}>Peak held · 0–100 grade</div>
      </div>
    </div>
  )
}

/* --- the verdict (13i) -------------------------------------------------- */

/** Who the room went back to after the fight. 13i draws no up-next strip any
 *  more; the type stays exported until the player stops passing one. */
export interface BattleUpNext {
  singer: string
  songTitle?: string
  songArtist?: string
}

/** One of the two fighters as the lights come up. A component rather than two
 *  useSpriteFrame calls inside Winner because the set differs per side, and a
 *  hook cannot be called from a map. The knockdown is a one-shot played from
 *  how far into the beat the room is, so it lands together on every screen;
 *  the victory loops on the wall clock for the whole beat, as 13i draws it. */
const WinFighter = ({ turn, at, set, elapsedMs }: {
  turn: BattleTurn
  at: BattleSide
  set: BattleSingerLoop
  elapsedMs: number
}) => {
  const frame = useSpriteFrame(singerOf(turn, at), set, set === 'ko' ? elapsedMs - KO_DELAY_MS : undefined)

  return (
    <SpriteBox
      src={frame}
      facing={facingOf(at)}
      className={clsx(styles.winSprite, at === 1 ? styles.winSpriteOne : styles.winSpriteTwo)}
    />
  )
}

/**
 * The verdict: the winner's room at full light, the victory and the
 * knockdown, a card per fighter with their count and what it was worth, and
 * tonight's totals rolling up to include it.
 *
 * `night` is tonight's points by user. The fight is paid as the verdict goes
 * up (D9), so it already includes the award once the room's POINTS_PUSH has
 * landed, and the count rolls up from the total before it.
 *
 * A draw is not designed: nobody took it, so there is no WINS and both
 * fighters take the knockdown.
 */
export const Winner = ({ turn, msLeft, night }: {
  turn: BattleTurn
  msLeft: number
  night: Record<number, number>
}) => {
  const isDraw = turn.challengerScore === turn.opponentScore
  const at: BattleSide = turn.challengerScore > turn.opponentScore ? 1 : 2
  // Both stamps are the server's, so their difference is the beat's true
  // length whatever this box's clock says.
  const elapsedMs = (turn.endsAt - turn.sentAt) - msLeft
  // Read once: an animation-delay that changes restarts its animation.
  const [t0] = useState(() => -Math.max(0, elapsedMs))

  const setFor = (side: BattleSide): BattleSingerLoop => (!isDraw && side === at ? 'victory' : 'ko')
  const awardOf = (side: BattleSide) => (!isDraw && side === at ? POINTS_BATTLE_WIN : POINTS_BATTLE_TAKE_PART)
  const userOf = (side: BattleSide) => (side === 1 ? turn.challengerUserId : turn.opponentUserId)

  return (
    <div className={styles.winScene} style={{ '--t0': `${t0}ms` } as React.CSSProperties}>
      <div className={styles.winScrim} />
      {([1, 2] as BattleSide[]).map(side => (
        <WinFighter key={side} turn={turn} at={side} set={setFor(side)} elapsedMs={elapsedMs} />
      ))}
      <Brand className={clsx(styles.brandLeft, styles.brandSmall)} />

      {([1, 2] as BattleSide[]).map((side) => {
        const award = awardOf(side)
        const after = night[userOf(side)] ?? 0

        return (
          <React.Fragment key={side}>
            <div className={clsx(styles.winCard, side === 1 ? styles.atOne : styles.atTwo, sideClass(side))}>
              <span className={clsx(styles.silk, styles.winCardName, styles.oneLine)} translate='no'>
                {nameOf(turn, side)}
              </span>
              <span className={clsx(styles.silk, styles.winVotes)}>
                {turn.judging === 'ballot' ? `${scoreOf(turn, side)} votes` : scoreOf(turn, side)}
              </span>
              <span className={styles.winPtsBox}>
                <span
                  className={clsx(
                    styles.silk,
                    styles.winPts,
                    award === POINTS_BATTLE_WIN ? styles.winPtsWin : styles.winPtsPlay,
                    side === 2 && styles.winPtsLate,
                  )}
                >
                  {`+${award}`}
                </span>
              </span>
            </div>
            <div className={clsx(styles.winTonight, side === 1 ? styles.atOne : styles.atTwo)}>
              <span className={clsx(styles.silk, styles.winTonightLabel)}>Tonight</span>
              <CountUp from={Math.max(0, after - award)} to={after} className={clsx(styles.display, styles.winTotal)} />
            </div>
          </React.Fragment>
        )
      })}

      {isDraw
        ? (
            <div className={styles.winHead}>
              <div className={clsx(styles.display, styles.winName)}>Draw</div>
              <div className={clsx(styles.silk, styles.winVerb)}>
                {turn.judging === 'none' ? 'No microphone on this player' : 'Nobody wins'}
              </div>
            </div>
          )
        : (
            // WINS, dropped in under the winner's own card
            <div className={clsx(styles.winWord, at === 1 ? styles.atOne : styles.atTwo)}>
              <WordArt
                kind='wins'
                width='calc(144 * var(--px))'
                style={{ ...WORD_ART_UNIT, animationDelay: 'calc(var(--t0) + 1000ms)' }}
              />
            </div>
          )}

      <WordArt
        kind='gameOver'
        width='calc(328 * var(--px))'
        style={{ ...WORD_ART_UNIT, animationDelay: 'var(--t0)' }}
      />
    </div>
  )
}
