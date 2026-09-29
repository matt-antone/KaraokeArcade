import React from 'react'
import clsx from 'clsx'
import {
  POINTS_BATTLE_TAKE_PART,
  POINTS_BATTLE_WIN,
  POINTS_SONG,
  TRIVIA_QUESTIONS_PER_ROUND,
  TRIVIA_ROUND_MIX,
} from 'shared/types'
import { battleSingerPortrait, type RosterSinger } from 'lib/battleSingers'
import Button from 'components/Button/Button'
import styles from './ScoringTutorial.css'

/**
 * How scoring works: shown once, right after somebody first picks who they
 * sing as, so the leaderboard is not a mystery the first time it moves.
 *
 * Every number is the server's own constant, never a copy — a tutorial that
 * promises 150 while the room pays something else is worse than none.
 *
 * "Once" is per account on this phone: see scoringSeen.ts.
 */

const LEVEL_LABEL: Record<string, string> = { easy: 'Easy', medium: 'Med', hard: 'Hard' }

/** Each value bursts in on its own beat, top to bottom, the shine a step behind. */
const delay = (ms: number) => ({ '--delay': `${ms}ms` }) as React.CSSProperties

const Row = ({ title, sub, points, tone, at }: {
  title: string
  sub: string
  points: number
  tone: string
  at: number
}) => (
  <div className={styles.card}>
    <span className={styles.shine} style={delay(at + 300)} />
    <div className={styles.what}>
      <span className={styles.title}>{title}</span>
      <span className={styles.sub}>{sub}</span>
    </div>
    <span className={clsx(styles.pts, styles[tone])} style={delay(at)}>
      +
      {points}
    </span>
  </div>
)

interface ScoringTutorialProps {
  singer: RosterSinger
  onContinue: () => void
}

const ScoringTutorial = ({ singer, onContinue }: ScoringTutorialProps) => (
  <div className={styles.body}>
    <div className={styles.masthead}>
      <div className={styles.portrait}>
        <img src={battleSingerPortrait(singer, 80)} alt='' />
      </div>
      <h1 className={styles.heading}>How to score</h1>
      <p className={styles.lede}>Points add up all night. Highest score tops the board.</p>
    </div>

    <div className={styles.cards}>
      <Row title='Sing a song' sub='Every song you finish' points={POINTS_SONG} tone='amber' at={400} />
      <Row title='Win a singer battle' sub='The room votes' points={POINTS_BATTLE_WIN} tone='yellow' at={750} />
      <Row title='Play in a battle' sub='Lose or draw' points={POINTS_BATTLE_TAKE_PART} tone='mint' at={1100} />

      <div className={styles.card}>
        <span className={styles.shine} style={delay(2150)} />
        <div className={styles.trivia}>
          <div className={styles.what}>
            <span className={styles.title}>Trivia</span>
            <span className={styles.sub}>
              {TRIVIA_QUESTIONS_PER_ROUND}
              {' '}
              questions a round · per right answer
            </span>
          </div>
          <div className={styles.levels}>
            {TRIVIA_ROUND_MIX.map((level, i) => (
              <span key={level.difficulty} className={clsx(styles.level, level.difficulty === 'hard' && styles.levelHard)}>
                {LEVEL_LABEL[level.difficulty] ?? level.difficulty}
                {' '}
                <span className={styles.pts} style={delay(1450 + i * 200)}>{level.points}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>

    <div className={styles.spacer} />
    <div className={styles.footer}>
      <Button variant='primary' className={styles.key} onClick={onContinue}>Continue</Button>
    </div>
  </div>
)

export default ScoringTutorial
