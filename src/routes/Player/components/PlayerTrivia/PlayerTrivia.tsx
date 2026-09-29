import React, { useEffect } from 'react'
import clsx from 'clsx'
import AnswerKey, { type AnswerKeyState } from 'components/AnswerKey/AnswerKey'
import Logo from 'components/Logo/Logo'
import TriviaPodium from 'components/TriviaPodium/TriviaPodium'
import TriviaRail from 'components/TriviaRail/TriviaRail'
import TriviaTally from 'components/TriviaTally/TriviaTally'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import { BATTLE_STAGE_PLATE, battleSingerKeyArt, battleSingerOrDefault, battleSingerStage } from 'lib/battleSingers'
import useNow from 'lib/useNow'
import { useAppSelector } from 'store/hooks'
import serverNow from 'lib/serverNow'
import { TRIVIA_QUESTIONS_PER_ROUND, type TriviaResult, type TriviaRound } from 'shared/types'
import { CHEER, GROAN, playCue, soundCue } from 'lib/soundCue'
import styles from './PlayerTrivia.css'

/** The design's stage. Every trivia screen is laid out at this size and scaled
 *  as a whole to the TV, so nothing reflows between a 720p box and a 4K one. */
const STAGE_W = 960
const STAGE_H = 540

/** The countdown's last stretch, when the room escalates to "lock it in". */
const URGENT_MS = 5000

/** The night's leaders the title card stands up while the room gathers. */
const SPLASH_LEADERS = 5

/** Rows under the podium: fourth place down to this. */
const SCOREBOARD_ROWS = 6

/* OpenTDB is CC BY-SA 4.0. The attribution is a licence obligation, so it
   rides on every screen a question or its answer is on. */
const attribution = (
  <div className={styles.attribution}>
    questions from opentdb.com — cc by-sa 4.0
  </div>
)

interface StageProps {
  width: number
  height: number
  /** The countdown's last stretch: the cabinet rings magenta. */
  isUrgent?: boolean
  children: React.ReactNode
}

/** The cabinet every trivia screen is drawn in: the arcade's ground, and a
 *  960 × 540 content layer scaled to fit the TV. The scanlines are global. */
const Stage = ({ width, height, isUrgent, children }: StageProps) => (
  <div style={{ width, height }} className={styles.container}>
    <div
      className={clsx(styles.frame, isUrgent && styles.urgent)}
      style={{ transform: `translate(-50%, -50%) scale(${Math.min(width / STAGE_W, height / STAGE_H)})` }}
    >
      <div className={styles.content}>
        {children}
      </div>
    </div>
  </div>
)

/**
 * The round's title card, covering the gap between the song before and the
 * first question — TRIVIA, pick up your phones — with the night's top five
 * under it, so the room knows who it is playing to catch.
 */
export const PlayerTriviaSplash = ({ width, height }: { width: number, height: number }) => {
  const room = useAppSelector(state => (
    state.user.roomId === null ? undefined : state.rooms.entities[state.user.roomId]?.name
  ))
  const leaders = useAppSelector(state => state.points.leaderboard).slice(0, SPLASH_LEADERS)

  return (
    <Stage width={width} height={height}>
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
                  <UserAvatar className={styles.leaderAvatar} avatarId={entry.avatarId} size={80} />
                  <span className={styles.leaderRank}>{i + 1}</span>
                </div>
                <span className={styles.leaderName} translate='no'>{entry.name}</span>
                <span className={styles.leaderPoints}>{entry.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className={styles.ready}>ready players</div>
    </Stage>
  )
}

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
const PlayerTrivia = ({ round, result, width, height }: PlayerTriviaProps) => {
  const tick = useNow()
  const scores = result?.scores ?? []
  const numCorrect = result?.numCorrect ?? 0

  // One beat at a time, never two at once: the question, then the answer, then
  // how many got it — and on the last question the standings, then the winner.
  // The final board's hold is split between those two.
  const now = result ? serverNow(result, tick) : 0
  const isTally = !!result && now >= result.scoresFrom
  const isScoreboard = !!result?.boardFrom && now >= result.boardFrom
  const isRoundOver = isScoreboard && now >= (result.boardFrom! + result.endsAt) / 2 && scores.length > 0

  // The count lands with a noise, on the one machine in the room with
  // speakers. Keyed on the question rather than the beat so it fires once
  // when the tally arrives, not on every tick it stays up, and best-effort
  // throughout: a player that will not autoplay still shows the number.
  useEffect(() => {
    if (!isTally || isScoreboard) return

    playCue(numCorrect ? CHEER : GROAN)
  }, [isTally, isScoreboard, numCorrect, result?.roundId])

  // Both cues are fetched while the question is still being answered: the
  // round is on screen for the whole countdown before either is wanted, and a
  // party's wifi is the wrong thing to be waiting on at the moment the count
  // lands. Which one plays is not known until then, so both are pulled.
  useEffect(() => {
    if (result) return
    for (const src of [CHEER, GROAN]) soundCue(src).load()
  }, [result, round.roundId])

  if (isRoundOver) {
    const [winner, ...rest] = scores
    const isTie = rest[0]?.score === winner.score
    const singer = battleSingerOrDefault(winner.avatarId)

    return (
      <Stage width={width} height={height}>
        {/* the winner's own stage, falling back to the dive bar when they have
            none: a missing first layer simply shows the one under it */}
        <div
          className={styles.winnerStage}
          style={{ backgroundImage: `url('${battleSingerStage(singer)}'), url('${BATTLE_STAGE_PLATE}')` }}
        />
        <img className={styles.winnerArt} src={battleSingerKeyArt(singer).url} alt='' />
        <div className={styles.winnerTop}>
          <Logo withMark markSize={18} />
          <span className={styles.eyebrow}>Trivia · final</span>
        </div>
        <div className={styles.winnerCard}>
          <div className={styles.winner} translate='no'>{isTie ? 'tie game' : `${winner.name} wins`}</div>
          <div className={styles.winnerScore}>
            <span className={styles.winnerPoints}>{winner.score}</span>
            <span className={styles.winnerUnit}>pts</span>
          </div>
        </div>
        {rest.length > 0 && (
          <div className={styles.runnersUp}>
            <span className={styles.caption}>Runners-up</span>
            <div className={styles.runners}>
              {rest.slice(0, 2).map((s, i) => (
                <div key={s.userId} className={styles.runner}>
                  <span className={styles.runnerRank}>{i + 2}</span>
                  <UserAvatar className={styles.runnerAvatar} avatarId={s.avatarId} />
                  <div className={styles.runnerText}>
                    <span className={styles.runnerName} translate='no'>{s.name}</span>
                    <span className={styles.runnerScore}>{s.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Stage>
    )
  }

  if (isScoreboard) {
    return (
      <Stage width={width} height={height}>
        <TriviaRail round={round} label='high scores' meta={`after Q${round.questionNumber}`} variant='player' />

        {scores.length > 0
          ? (
              <>
                <div className={styles.podium}>
                  <TriviaPodium scores={scores} variant='player' />
                </div>
                <div className={styles.rows}>
                  {scores.slice(3, SCOREBOARD_ROWS).map((s, i) => (
                    <div key={s.userId} className={styles.row}>
                      <span className={styles.rank}>{String(i + 4).padStart(2, '0')}</span>
                      <span className={styles.rowName} translate='no'>{s.name}</span>
                      <span className={styles.rowScore}>{s.score}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          : <div className={styles.stage}><div className={styles.question}>Nobody played</div></div>}
      </Stage>
    )
  }

  // How the room did on the question just asked. Every question gets this,
  // the last one included.
  if (isTally) {
    return (
      <Stage width={width} height={height}>
        <TriviaRail round={round} label='who got it' variant='player' />
        <div className={styles.stage}>
          <TriviaTally numCorrect={numCorrect} variant='player' />
        </div>
        {attribution}
      </Stage>
    )
  }

  // The last five seconds are this same screen crossing a line, not a beat of
  // their own: the room goes magenta and the clock swells.
  // Same whole-second rounding the clock uses, so the swell lands on its 5.
  const isUrgent = !result && Math.ceil((round.endsAt - serverNow(round, tick)) / 1000) * 1000 <= URGENT_MS

  const stateOf = (i: number): AnswerKeyState => {
    if (!result) return 'open'
    return i === result.correctIdx ? 'correct' : 'wrong'
  }

  return (
    <Stage width={width} height={height} isUrgent={isUrgent}>
      <TriviaRail
        round={round}
        label={result ? 'answer' : 'trivia'}
        tone={result ? 'mint' : 'yellow'}
        isRunning={!result}
        isUrgent={isUrgent}
        variant='player'
      />

      <div className={styles.stage}>
        <div
          className={styles.question}
          style={{ '--len': round.question.length } as React.CSSProperties}
          translate='no'
        >
          {round.question}
        </div>
      </div>

      <div className={styles.answers}>
        {round.answers.map((answer, i) => (
          <AnswerKey key={answer} index={i} label={answer} variant='player' state={stateOf(i)} disabled />
        ))}
      </div>

      {attribution}
    </Stage>
  )
}

export default PlayerTrivia
