import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import alertCue from 'lib/alertCue'
import useBattleStage from 'lib/useBattleStage'
import { formatDuration } from 'lib/dateTime'
import BattleFrame from 'components/BattleStage/BattleFrame'
import BattleKey from 'components/BattleStage/BattleKey'
import BattleFighter, { BattleResult, HpGrid, Location } from 'components/BattleFighter/BattleFighter'
import { sideOf } from 'components/BattleFighter/battleSide'
import BattleSetup from 'components/BattleSetup/BattleSetup'
import SpriteLoop from 'components/SpriteLoop/SpriteLoop'
import { battleSingerPortrait } from 'lib/battleSingers'
import { castBattleVote, requestBattleSingers } from 'store/modules/battle'
import { BATTLE_JUDGE_BALLOT_MS } from 'shared/types'
import type { BattleSide } from 'shared/types'
import styles from './BattleVote.css'

/**
 * Every phone in the room, for the beats of a battle that have a phone screen.
 * Arcade Flow v2 2d; the beat on stage picks the screen, and nothing here
 * advances by itself.
 *
 *   the two fighters   13e/13e2 on their own round (BattleFighter), and
 *                      13j/13j2 on the verdict
 *   everyone else      13h on the vote, 13h2 once voted, 13j3 on the verdict.
 *                      While the songs are sung they keep the normal app.
 *
 * The vote is live (U-13): the split fills as the room votes, on the TV and
 * in 13h's HP cells, from the per-side counts the server re-sends on every
 * vote. Crowd judging is graded by the player's own microphone and asks no
 * phone for anything, so watchers see no 13h on that path; they still get 13j3,
 * drawn without the Your-vote row.
 */

/** 13h's HP cells: one lit cell per vote, ten at most (7–5 lights 7 and 5). */
const hpOf = (votes: number) => Math.min(10, votes)

const BattleVote = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { turn, phase, msLeft } = useBattleStage()
  const userId = useAppSelector(state => state.user.userId)
  const vote = useAppSelector(state => state.battle.vote)
  /* "Back to songs" puts the screen down for the rest of its beat; the next
     beat (the verdict) still comes up. */
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [isRematch, setIsRematch] = useState(false)

  const side: BattleSide | null = !turn
    ? null
    : userId === turn.challengerUserId ? 1 : userId === turn.opponentUserId ? 2 : null
  const hasVoted = !!turn && vote?.queueId === turn.queueId
  const beatKey = turn ? `${turn.queueId}:${phase}` : null

  const screen = !turn || dismissed === beatKey
    ? null
    : side
      ? (phase === 'winner' ? 'fighterResult' : 'fighter')
      : phase === 'winner'
        ? 'result'
        : phase === 'judge' && turn.judging === 'ballot'
          ? (hasVoted ? 'cast' : 'ballot')
          : null

  // The ballot opening is the only notice a guest gets, and it arrives on a
  // phone that is face down as often as not.
  const isAsking = screen === 'ballot'
  useEffect(() => {
    if (isAsking) alertCue()
  }, [isAsking])

  // 13j2's Rematch opens 13a from here, and outlives the verdict beat
  if (isRematch) return <BattleSetup isOpen onClose={() => setIsRematch(false)} />

  if (!turn || !screen) return null

  const backToSongs = () => {
    setDismissed(beatKey)
    navigate('/library')
  }

  if (screen === 'fighter' && side) return <BattleFighter turn={turn} side={side} msLeft={msLeft} />

  if (screen === 'fighterResult' || screen === 'result') {
    return (
      <BattleResult
        turn={turn}
        side={side}
        vote={hasVoted ? vote?.side : null}
        onBack={backToSongs}
        onRematch={() => {
          dispatch(requestBattleSingers())
          setDismissed(beatKey)
          setIsRematch(true)
        }}
      />
    )
  }

  const seconds = formatDuration(Math.ceil(msLeft / 1000))

  /* 13h2 · sealed. */
  if (screen === 'cast') {
    const at = vote?.side ?? 1
    const picked = sideOf(turn, at)

    return (
      <BattleFrame status='Voted' statusTone='mint'>
        <div className={styles.centre}>
          <div className={clsx(styles.pick, at === 1 ? styles.pickOne : styles.pickTwo)}>
            <img src={battleSingerPortrait(picked.singer, 80)} alt='' />
          </div>
          <span className={styles.locked}>
            VOTE
            <br />
            LOCKED
          </span>
          <span className={styles.youVoted}>
            {'You voted '}
            <b className={at === 1 ? styles.one : styles.two} translate='no'>{picked.name}</b>
          </span>
          <span className={styles.results}>{`Results on the TV · ${seconds}`}</span>
        </div>
        <div className={styles.footer}>
          <BattleKey variant='ghost' onClick={backToSongs}>Back to songs</BattleKey>
        </div>
      </BattleFrame>
    )
  }

  /* 13h · the two fighters stacked in their own rooms, VS between them, and
     the vote across the foot. */
  return (
    <BattleFrame status='Voting' statusTone='mint'>
      {([1, 2] as BattleSide[]).map((at) => {
        const fighter = sideOf(turn, at)

        return (
          <React.Fragment key={at}>
            {at === 2 && (
              <div className={styles.vsBand}>
                <span className={styles.vs}>VS</span>
              </div>
            )}
            <div className={clsx(styles.half, at === 1 ? styles.halfOne : styles.halfTwo)}>
              <Location singer={fighter.singer} className={styles.dimHalf} />
              <SpriteLoop
                singer={fighter.singer}
                loop='sing'
                size='340px'
                facing={at === 1 ? 'right' : 'left'}
                className={at === 1 ? styles.spriteOne : styles.spriteTwo}
              />
              <div className={clsx(styles.who, at === 2 && styles.whoTwo)}>
                <span className={clsx(styles.chip, at === 1 ? styles.chipOne : styles.chipTwo)}>{`P${at}`}</span>
                <span className={styles.name} translate='no'>{fighter.name}</span>
                <span className={styles.song} translate='no'>{fighter.song.title}</span>
              </div>
              <HpGrid
                lit={hpOf(fighter.votes)}
                side={at}
                className={clsx(styles.hp, at === 1 ? styles.hpOne : styles.hpTwo)}
              />
            </div>
          </React.Fragment>
        )
      })}

      <div className={styles.ask}>
        <div className={styles.askRow}>
          <span className={styles.askWord}>Who wins?</span>
          <span className={styles.clock}>{seconds}</span>
        </div>
        <div className={styles.clockWell}>
          <div
            className={styles.clockFill}
            style={{ width: `${Math.max(0, Math.min(1, msLeft / BATTLE_JUDGE_BALLOT_MS)) * 100}%` }}
          />
        </div>
        <span className={styles.rule}>One vote · anonymous</span>
      </div>

      <div className={styles.keys}>
        {([1, 2] as BattleSide[]).map(at => (
          <BattleKey
            key={at}
            tone={at === 1 ? 'red' : 'green'}
            size='vote'
            onClick={() => dispatch(castBattleVote(turn.queueId, at))}
          >
            {`Vote P${at}`}
          </BattleKey>
        ))}
      </div>
    </BattleFrame>
  )
}

export default BattleVote
