import React from 'react'
import clsx from 'clsx'
import Button from 'components/Button/Button'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import VuMeter from 'components/VuMeter/VuMeter'
import { ordinal } from 'lib/ordinal'
import styles from './YourTurn.css'

export interface YourTurnProps {
  /** Display name, read at the top of the identity column. */
  name?: string | null
  /** The account's fighter, drawn as the portrait tile. */
  avatarId?: string | null
  /** Tonight's points, as a raw integer. */
  points?: number
  /** Tonight's place; null when not on the board. */
  rank?: number | null
  /** This singer is on stage right now. */
  isUpNow?: boolean
  /** Title of the song on stage, while they are the one singing it. */
  nowSong?: string
  /** Pre-formatted wait until their next song, e.g. "3m". */
  wait?: string
  /** Their place in the rotation, 1-based. 0 when they have nothing coming up. */
  position?: number
  /** How many singers are in the rotation. */
  rotationSize?: number
  /** How many songs they have queued (held, while paused). */
  songCount?: number
  /** Title of their next song — what they are actually waiting for. */
  nextSong?: string
  /**
   * 0-1: how far the room's queue has drained toward their turn. Ticks with
   * the playhead. Falls back to their place in the rotation when unknown.
   */
  waitLevel?: number
  /** They have stepped out of the rotation. */
  isPaused?: boolean
  onTogglePaused?: () => void
  /** The VS key. Always drawn; the caller decides what a press does when the
   *  room has battles switched off. */
  onBattle?: () => void
}

/** Nothing queued and not sitting out is its own state: the design's 07b card,
 *  one muted row. A place in the rotation counts as queued even when the
 *  caller passed no count, so this asks both. */
const getIsIdle = (isPaused?: boolean, isUpNow?: boolean, songCount = 0, position = 0) =>
  !isPaused && !isUpNow && songCount === 0 && !position

/** The meter fills as their turn approaches. waitLevel is the live one — the
 *  room's queue draining toward them — and the rotation index is the fallback
 *  for before the player has reported a position. */
const getLevel = (
  isUpNow: boolean | undefined,
  { waitLevel, position, rotationSize }: { waitLevel?: number, position: number, rotationSize: number },
) => {
  if (isUpNow) return 1
  if (waitLevel !== undefined) return waitLevel
  if (position && rotationSize) return Math.max(0.06, 1 - (position - 1) / rotationSize)

  return 0.5
}

/**
 * The HUD block under the brand row, on every in-app screen: who you are and
 * how tonight is going, the VS and pause keys, then the Your-turn card. The
 * card has three faces, as the design draws them — queued (04), empty (07b)
 * and paused (07c) — plus on stage, which the design never draws and which
 * reads in the queued face's grammar with "Now" and a full meter.
 */
const YourTurn = ({
  name,
  avatarId,
  points = 0,
  rank = null,
  isUpNow,
  nowSong,
  wait,
  position = 0,
  rotationSize = 0,
  songCount = 0,
  nextSong,
  waitLevel,
  isPaused,
  onTogglePaused,
  onBattle,
}: YourTurnProps) => {
  const isIdle = getIsIdle(isPaused, isUpNow, songCount, position)

  const card = isPaused
    ? (
        <div className={clsx(styles.card, styles.row, styles.paused)}>
          <span className={clsx(styles.legend, styles.legendPaused)}>Paused</span>
          <span className={styles.hold}>
            {songCount === 1 ? '1 song on hold' : `${songCount} songs on hold`}
          </span>
          <button type='button' className={styles.resume} onClick={onTogglePaused}>Resume</button>
        </div>
      )
    : isIdle
      ? (
          <div className={clsx(styles.card, styles.row)}>
            <span className={clsx(styles.legend, styles.legendIdle)}>Your turn</span>
            <span className={styles.empty}>No songs queued</span>
          </div>
        )
      : (
          <div className={styles.card}>
            <div className={styles.line}>
              <span className={styles.legend}>Your turn</span>
              <span className={styles.title}>{isUpNow ? nowSong : nextSong}</span>
              {(isUpNow || wait) && <span className={styles.wait}>{isUpNow ? 'Now' : wait}</span>}
            </div>
            <VuMeter
              value={getLevel(isUpNow, { waitLevel, position, rotationSize })}
              segments={24}
              peakFrom={20 / 24}
              height={8}
              gap={2}
              label='Your turn'
            />
          </div>
        )

  return (
    <div className={styles.container}>
      <div className={styles.identity}>
        <UserAvatar className={styles.avatar} avatarId={avatarId} />
        <div className={styles.who}>
          <span className={styles.name}>{name}</span>
          <div className={styles.tonight}>
            <span className={styles.tonightLabel}>Tonight</span>
            <span className={styles.points}>{points}</span>
            {rank !== null && <span className={styles.rank}>{ordinal(rank)}</span>}
          </div>
        </div>
        <div className={styles.keys}>
          <button type='button' className={clsx(styles.key, styles.plain, styles.vs)} aria-label='Start a singer battle' onClick={onBattle}>
            VS
          </button>
          {/* possessive on purpose: pausing the *room* is a different,
              admin-only thing that lives in Settings > Player */}
          {isPaused
            ? (
                <Button variant='yellow' className={styles.key} aria-label='Resume my songs' onClick={onTogglePaused}>
                  {/* the play glyph (U+25B6) is Extended_Pictographic and fails the emoji rule, so it is a CSS triangle */}
                  <span className={styles.play} />
                </Button>
              )
            : (
                <button type='button' className={clsx(styles.key, styles.plain)} aria-label='Pause my songs' onClick={onTogglePaused}>
                  II
                </button>
              )}
        </div>
      </div>

      {card}
    </div>
  )
}

export default YourTurn
