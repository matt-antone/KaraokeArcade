import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import AnswerKey, { type AnswerKeyState } from 'components/AnswerKey/AnswerKey'
import CountUp from 'components/CountUp/CountUp'
import Logo from 'components/Logo/Logo'
import SpriteLoop, { SpriteBox } from 'components/SpriteLoop/SpriteLoop'
import TriviaRail from 'components/TriviaRail/TriviaRail'
import TriviaTally from 'components/TriviaTally/TriviaTally'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import WordArt from 'components/WordArt/WordArt'
import {
  BATTLE_STAGE_PLATE,
  battleSingerFrontArt,
  battleSingerOrDefault,
  battleSingerSet,
  battleSingerStage,
  setFrameMs,
  type RosterSinger,
} from 'lib/battleSingers'
import { useFighterSet } from 'lib/fighterSets'
import useNow from 'lib/useNow'
import { useAppSelector } from 'store/hooks'
import serverNow from 'lib/serverNow'
import {
  TRIVIA_QUESTIONS_PER_ROUND,
  triviaPoints,
  type TriviaPodium,
  type TriviaResult,
  type TriviaRound,
} from 'shared/types'
import { CHEER, GROAN, playCue, soundCue } from 'lib/soundCue'
import { PODIUM_HEIGHTS, podiumsOf } from './podiums'
import styles from './PlayerTrivia.css'

/** The design's stage. Every trivia screen is laid out at this size and scaled
 *  as a whole to the TV, so nothing reflows between a 720p box and a 4K one. */
const STAGE_W = 960
const STAGE_H = 540

/** The night's leaders the title card stands up while the room gathers. */
const SPLASH_LEADERS = 5

/** Runners-up beside the winner: second and third. */
const RUNNERS_UP = 2

/** 12c: the podiums rise one after another, 180ms apart, once the answer has
 *  had half a second to itself. The numeral bursts and the character lands
 *  as each one arrives. */
const RISE_AFTER_MS = 500
const RISE_STAGGER_MS = 180
const NUMERAL_AFTER_MS = 650
const LAND_AFTER_MS = 700

/* OpenTDB is CC BY-SA 4.0. The attribution is a licence obligation: one
   small line on the splash and in the floor under every question and its
   answer. */
const attribution = (
  <span className={styles.attribution}>
    Questions from opentdb.com · CC BY-SA 4.0
  </span>
)

interface StageProps {
  width: number
  height: number
  children: React.ReactNode
}

/** The cabinet every trivia screen is drawn in: the arcade's ground, and a
 *  960 × 540 content layer scaled to fit the TV, under its own scanlines. */
const Stage = ({ width, height, children }: StageProps) => (
  <div style={{ width, height }} className={styles.container}>
    <div
      className={styles.frame}
      style={{ transform: `translate(-50%, -50%) scale(${Math.min(width / STAGE_W, height / STAGE_H)})` }}
    >
      {children}
    </div>
  </div>
)

/**
 * 12a · the round's title card, covering the gap between the song before and
 * the first question, with the night's top five under it, so the room knows
 * who it is playing to catch.
 */
export const PlayerTriviaSplash = ({ intermissionEndsAt, width, height }: {
  /** When the gap before the round runs out, by this box's clock. Absent
   *  once the row is current and the round is on its way: the count holds at
   *  0 until it lands. */
  intermissionEndsAt?: number | null
  width: number
  height: number
}) => {
  const now = useNow()
  const room = useAppSelector(state => (
    state.user.roomId === null ? undefined : state.rooms.entities[state.user.roomId]?.name
  ))
  // everyone who joins is on the board at 0; only the night's scorers stand up
  const leaders = useAppSelector(state => state.points.leaderboard).filter(e => e.points > 0).slice(0, SPLASH_LEADERS)
  const secondsLeft = intermissionEndsAt ? Math.max(0, Math.ceil((intermissionEndsAt - now) / 1000)) : 0

  return (
    <Stage width={width} height={height}>
      <div className={styles.splash}>
        <div className={styles.splashTop}>
          <Logo withMark markSize={18} />
          <span className={styles.venue} translate='no'>{room}</span>
        </div>
        <div className={styles.splashPips} aria-hidden='true'>
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className={styles.splashTitle}>Trivia</div>
        <div className={styles.body}>{`${TRIVIA_QUESTIONS_PER_ROUND} questions · answer on your phone`}</div>
        <div className={styles.spacer} />
        {leaders.length > 0 && (
          <div className={styles.leaders}>
            <span className={styles.caption}>{`Tonight's top ${leaders.length}`}</span>
            <div className={styles.leaderRow}>
              {leaders.map((entry, i) => (
                <div key={entry.userId} className={styles.leader}>
                  <div className={styles.leaderFace}>
                    <UserAvatar className={styles.leaderAvatar} avatarId={entry.avatarId} />
                    <span className={styles.leaderRank}>{i + 1}</span>
                  </div>
                  <span className={styles.leaderName} translate='no'>{entry.name}</span>
                  <span className={styles.leaderPoints}>{entry.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={styles.ready}>{`Starting in ${secondsLeft}`}</div>
        <div className={styles.splashCredit}>{attribution}</div>
      </div>
    </Stage>
  )
}

/** The winner's victory, looping as 12d draws it. SpriteLoop plays a one-shot
 *  once and holds it, so the loop is handed to it as time into the sheet. */
const VictoryLoop = ({ singer }: { singer: RosterSinger }) => {
  const set = useFighterSet(singer.group, singer.slug, 'victory', battleSingerSet(singer, 'victory'))
  const frameMs = setFrameMs(set)
  const now = useNow(frameMs)
  const [start] = useState(now)

  return (
    <SpriteLoop
      className={styles.winnerSprite}
      singer={singer}
      loop='victory'
      size='560px'
      facing='left'
      elapsedMs={(now - start) % (set.frames * frameMs)}
    />
  )
}

/**
 * 12d · the round's winner: their character on their own stage, what they
 * made this round, and their night total counting up to include it. The
 * runners-up beside, then GAME OVER. A tie names no one and counts no one up.
 */
const TriviaWinner = ({ result }: { result: TriviaResult }) => {
  const leaderboard = useAppSelector(state => state.points.leaderboard)
  const [winner, ...rest] = result.standings

  const corners = (
    <>
      <Logo className={styles.winnerLogo} withMark markSize={18} />
      <span className={styles.eyebrow}>Trivia · final</span>
    </>
  )

  if (!winner) {
    return (
      <>
        {corners}
        <div className={styles.winnerCard}>
          <span className={styles.winner}>Nobody played</span>
        </div>
        <WordArt kind='gameOver' width='820px' />
      </>
    )
  }

  const isTie = rest[0]?.points === winner.points
  const singer = battleSingerOrDefault(winner.avatarId)
  // The board already carries this round (the close pushes points), so the
  // count runs from the night before it.
  const tonight = leaderboard.find(e => e.userId === winner.userId)?.points ?? winner.points

  return (
    <>
      {/* the winner's own stage, falling back to the dive bar when they have
          none: a missing first layer simply shows the one under it */}
      <div
        className={styles.winnerStage}
        style={{ backgroundImage: `url('${battleSingerStage(singer)}'), url('${BATTLE_STAGE_PLATE}')` }}
      />
      <VictoryLoop singer={singer} />
      {corners}
      <div className={styles.winnerCard}>
        <span className={styles.winner} translate='no'>{isTie ? 'Tie game' : winner.name}</span>
        <div className={styles.roundLine}>
          <span className={styles.roundPoints}>{`+${winner.points}`}</span>
          <span className={styles.roundNote}>
            {isTie ? 'this round' : `this round · ${winner.numCorrect}/${result.questionCount} correct`}
          </span>
        </div>
        {!isTie && (
          <div className={styles.tonight}>
            <span className={styles.caption}>Tonight</span>
            <CountUp className={styles.tonightTotal} from={tonight - winner.points} to={tonight} />
          </div>
        )}
      </div>
      {rest.length > 0 && (
        <div className={styles.runnersUp}>
          <span className={styles.caption}>Runners-up</span>
          <div className={styles.runners}>
            {rest.slice(0, RUNNERS_UP).map((s, i) => (
              <div key={s.userId} className={styles.runner}>
                <span className={styles.runnerRank}>{i + 2}</span>
                <UserAvatar className={styles.runnerAvatar} avatarId={s.avatarId} />
                <div className={styles.runnerText}>
                  <span className={styles.runnerName} translate='no'>{s.name}</span>
                  <span className={styles.runnerScore}>{s.points}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!isTie && (
        <div className={styles.wins}>
          <WordArt kind='wins' width='360px' style={{ animationDelay: '1000ms' }} />
        </div>
      )}
      <WordArt kind='gameOver' width='820px' />
    </>
  )
}

/** A knockdown, played once from when the podium lands and held on the
 *  floor — ko is a one-shot, so it is handed the time into the sheet. */
const Knockdown = ({ singer, delayMs }: { singer: RosterSinger, delayMs: number }) => {
  const set = useFighterSet(singer.group, singer.slug, 'ko', battleSingerSet(singer, 'ko'))
  const now = useNow(setFrameMs(set))
  const [start] = useState(now)

  return (
    <SpriteLoop
      className={styles.podiumSprite}
      singer={singer}
      loop='ko'
      size='196px'
      facing='left'
      elapsedMs={now - start - delayMs}
    />
  )
}

/** Who a podium's character is, and what they are doing: standing to face
 *  the question (12b), then on the reveal (12c) a victory for a right answer,
 *  a knockdown for a wrong one, and still standing for one sat out. */
const PodiumCharacter = ({ podium, isReveal, delayMs }: { podium: TriviaPodium, isReveal: boolean, delayMs: number }) => {
  const singer = battleSingerOrDefault(podium.avatarId)

  if (isReveal && podium.isCorrect === true) {
    return <SpriteLoop className={styles.podiumSprite} singer={singer} loop='victory' size='196px' facing='left' />
  }

  if (isReveal && podium.isCorrect === false) return <Knockdown singer={singer} delayMs={delayMs} />

  return <SpriteBox className={styles.podiumFront} src={battleSingerFrontArt(singer)} facing='left' />
}

/**
 * 12b and 12c: the round's players on podiums under the answers, first on
 * the left. On the question they stand facing it; on the reveal they drop
 * away and rise again, each with what this question paid them.
 */
const TriviaPodiums = ({ podiums, round, isReveal }: { podiums: TriviaPodium[], round: TriviaRound, isReveal: boolean }) => (
  <div className={clsx(styles.podiums, isReveal && styles.podiumsRise)}>
    {podiums.map((podium, i) => {
      const riseMs = RISE_AFTER_MS + i * RISE_STAGGER_MS

      return (
        <div key={podium.userId} className={styles.podium} style={isReveal ? { animationDelay: `${riseMs}ms` } : undefined}>
          <div className={styles.podiumTop}>
            <div
              className={styles.podiumRank}
              style={isReveal ? { animationDelay: `${riseMs + NUMERAL_AFTER_MS}ms` } : undefined}
            >
              {i + 1}
            </div>
            <PodiumCharacter podium={podium} isReveal={isReveal} delayMs={riseMs + LAND_AFTER_MS} />
          </div>
          <div className={styles.podiumLedge} />
          <div className={styles.podiumBase} style={{ height: PODIUM_HEIGHTS[i] }}>
            {isReveal && (
              <span className={clsx(styles.podiumGain, podium.isCorrect && styles.podiumGained)}>
                {`+${podium.isCorrect ? triviaPoints(round.difficulty) : 0}`}
              </span>
            )}
            <span className={styles.podiumScore}>{podium.points}</span>
            <span className={styles.podiumName} translate='no'>{podium.name}</span>
          </div>
        </div>
      )
    })}
  </div>
)

interface PlayerTriviaProps {
  round: TriviaRound
  /** Set once answering has closed; switches the screen to the reveal. */
  result?: TriviaResult | null
  width: number
  height: number
}

/**
 * A trivia round on the TV. It takes the gap between two singers, so it is a
 * full takeover of the stage in the same way the intermission is.
 *
 * The phones carry the same four answers, so the room is not forced to look up
 * to play — but this is where they are big enough to read together, and where
 * the reveal happens for everyone at once.
 */
/** The ground under the answers on 12b/12c: the podiums (the round so far on
 *  the question, with this one counted in on the reveal), or the count on its
 *  own beat (tally), and OpenTDB's credit wherever the podiums leave room. */
const QuestionStage = ({ round, podiums, isReveal, tally }: {
  round: TriviaRound
  podiums: TriviaPodium[]
  isReveal: boolean
  tally: number | null
}) => (
  <div className={styles.stage}>
    {tally !== null && <TriviaTally numCorrect={tally} variant='player' />}
    <div className={styles.floor}>{!podiums.length && attribution}</div>
    {podiums.length > 0 && (
      <>
        {/* keyed on the beat, so the reveal drops them and raises them again */}
        <TriviaPodiums key={`${round.roundId}:${isReveal ? 'answer' : 'ask'}`} podiums={podiums} round={round} isReveal={isReveal} />
        {/* the podiums stand on the floor, so the credit goes up top */}
        <div className={styles.credit}>{attribution}</div>
      </>
    )}
  </div>
)

const PlayerTrivia = ({ round, result, width, height }: PlayerTriviaProps) => {
  const tick = useNow()
  const leaderboard = useAppSelector(state => state.points.leaderboard)
  const numCorrect = result?.numCorrect ?? 0

  // One beat at a time: the question (12b), then the answer (12c), then how
  // many got it, under the answer — and after the last question, the winner
  // (12d) for the whole of the final board.
  const now = result ? serverNow(result, tick) : 0
  const isTally = !!result && now >= result.scoresFrom
  const isBoard = !!result?.boardFrom && now >= result.boardFrom

  // The count lands with a noise, on the one machine in the room with
  // speakers. Keyed on the question rather than the beat so it fires once
  // when the tally arrives, not on every tick it stays up, and best-effort
  // throughout: a player that will not autoplay still shows the number.
  useEffect(() => {
    if (!isTally || isBoard) return

    playCue(numCorrect ? CHEER : GROAN)
  }, [isTally, isBoard, numCorrect, result?.roundId])

  // Both cues are fetched while the question is still being answered: which
  // one plays is not known until the count lands, and a party's wifi is the
  // wrong thing to be waiting on then.
  useEffect(() => {
    if (result) return
    for (const src of [CHEER, GROAN]) soundCue(src).load()
  }, [result, round.roundId])

  if (isBoard) {
    return (
      <Stage width={width} height={height}>
        <TriviaWinner result={result} />
      </Stage>
    )
  }

  const stateOf = (i: number): AnswerKeyState => {
    if (!result) return 'open'
    return i === result.correctIdx ? 'correct' : 'wrong'
  }

  return (
    <Stage width={width} height={height}>
      <div className={styles.screen}>
        <TriviaRail round={round} isAnswer={!!result} />

        <div className={styles.question} translate='no'>{round.question}</div>

        <div className={styles.answers}>
          {round.answers.map((answer, i) => (
            <AnswerKey key={answer} index={i} label={answer} variant='player' state={stateOf(i)} disabled />
          ))}
        </div>

        {/* the podiums, under the question and again under its answer; the
            count takes their place for its own beat */}
        <QuestionStage
          round={round}
          podiums={isTally ? [] : podiumsOf(result ? result.podiums : round.podiums, leaderboard)}
          isReveal={!!result}
          tally={isTally ? numCorrect : null}
        />
      </div>
    </Stage>
  )
}

export default PlayerTrivia
