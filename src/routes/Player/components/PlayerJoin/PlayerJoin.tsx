import React from 'react'
import clsx from 'clsx'
import screenfull from 'screenfull'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import { useAppDispatch } from 'store/hooks'
import { requestPlay } from 'store/modules/status'
import { BATTLE_SINGERS, BATTLE_STAGE_PLATE, battleSingerFrontArt, battleSingerStage } from 'lib/battleSingers'
import type { LeaderboardEntry } from 'shared/types'
import PlayerScores from '../PlayerScores/PlayerScores'
import { joinCountOf } from './crowd'
import { useCrowd, useIsScoresTurn } from './useJoinScreen'
import styles from './PlayerJoin.css'

/** The stage the room stands on once anybody is in: the design's. */
const JOIN_STAGE = battleSingerStage(BATTLE_SINGERS.find(s => s.slug === 'screamer') ?? BATTLE_SINGERS[0])

interface PlayerJoinProps {
  /** The room's name: the venue top right, and the design's code slot (U-21:
   *  there are no room codes; the QR is the way in). */
  roomName?: string
  /** The join QR, always in the column. */
  qr?: React.ReactNode
  leaderboard: LeaderboardEntry[]
  /** Singers in the room right now (phones, not the TV). */
  singerCount: number
  /** Nothing has been asked to play yet: browsers need a tap before autoplay. */
  isIdle: boolean
}

const handleFullscreen = () => {
  if (screenfull.isEnabled) screenfull.request(document.getElementById('player-fs-container'))
}

/**
 * 10 · The TV between songs: how to join on the left, the room on the right —
 * one figure per singer in, as the fighter they picked, up to forty. The
 * design fills the room with random picks; ours is the people actually in it
 * (see seatsFor).
 *
 * Once anyone is on tonight's board the screen takes turns with 14 · Tonight's
 * scores — the idle stage is the one slot where the leaderboard interrupts
 * nothing, and the room is standing around waiting anyway.
 */
const PlayerJoin = ({ roomName, qr, leaderboard, singerCount, isIdle }: PlayerJoinProps) => {
  const dispatch = useAppDispatch()
  const crowd = useCrowd()
  const isScoresTurn = useIsScoresTurn(leaderboard.length > 0)

  if (isScoresTurn) {
    return (
      <PlayerScores
        leaderboard={leaderboard}
        venue={roomName}
        onPlay={isIdle ? () => dispatch(requestPlay()) : undefined}
      />
    )
  }

  return (
    <div className={styles.container}>
      {singerCount > 0 && (
        <div
          className={styles.stage}
          style={{ backgroundImage: `url('${JOIN_STAGE}'), url('${BATTLE_STAGE_PLATE}')` }}
        />
      )}
      <div className={styles.panel} />
      <div className={styles.crowd} aria-hidden>
        {crowd.map(member => (
          <img
            key={member.seat}
            className={clsx(styles.member, !member.isHere && styles.away)}
            src={battleSingerFrontArt(member.singer).url}
            alt=''
            style={{ '--row': member.row, '--x': member.x } as React.CSSProperties}
          />
        ))}
      </div>
      <div className={styles.join}>
        <img className={styles.logo} src='assets/arcade/logo.svg' alt='KaraokeArcade' />
        {/* the reassurance is undesigned and asked for: trivia and battle
            votes need nobody at the mic */}
        <div className={styles.headlineGroup}>
          <span className={styles.headline}>Scan to play</span>
          <span className={styles.tagline}>No singing necessary</span>
        </div>
        <div className={styles.codeRow}>
          {qr}
          <div className={styles.code}>
            <span className={styles.blink}>Insert token</span>
            <span className={styles.joinCount}>{joinCountOf(singerCount)}</span>
          </div>
        </div>
        {/* under the code rather than beside it: a venue name is as long as
            the venue likes, and beside the QR it ran out into the crowd */}
        {roomName && (
          <div className={styles.room}>
            <span className={styles.codeLabel}>Room code</span>
            <span className={styles.codeValue} translate='no'>{roomName}</span>
          </div>
        )}
        {/* undesigned and needed (U-23): browsers won't autoplay without a tap */}
        {isIdle && (
          <Button variant='primary' cta className={styles.playKey} onClick={() => dispatch(requestPlay())}>
            Start
          </Button>
        )}
      </div>
      {roomName && <span className={styles.venue} translate='no'>{roomName}</span>}
      {isIdle && screenfull.isEnabled && !screenfull.isFullscreen && (
        <button className={styles.fullscreenKey} onClick={handleFullscreen} aria-label='Fullscreen'>
          <Icon icon='FULLSCREEN' />
        </button>
      )}
      <div className={styles.scanlines} />
    </div>
  )
}

export default PlayerJoin
