import React, { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import screenfull from 'screenfull'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import { useAppDispatch } from 'store/hooks'
import { requestPlay } from 'store/modules/status'
import { BATTLE_SINGERS, BATTLE_STAGE_PLATE, battleSingerAt, battleSingerFrontArt, battleSingerStage } from 'lib/battleSingers'
import { useFighterListing } from 'lib/fighterSets'
import type { LeaderboardEntry } from 'shared/types'
import PlayerScores from '../PlayerScores/PlayerScores'
import { CROWD_MAX, crowdOf, joinCountOf } from './crowd'
import styles from './PlayerJoin.css'

/** How long each of the two idle screens holds before handing to the other. */
const SWAP_MS = 20000

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
 * one figure per singer in, up to forty.
 *
 * Once anyone is on tonight's board the screen takes turns with 14 · Tonight's
 * scores — the idle stage is the one slot where the leaderboard interrupts
 * nothing, and the room is standing around waiting anyway.
 */
const PlayerJoin = ({ roomName, qr, leaderboard, singerCount, isIdle }: PlayerJoinProps) => {
  const dispatch = useAppDispatch()
  // Drawn once per mount, so the crowd holds still across every re-render.
  const [seeds] = useState(() => Array.from({ length: CROWD_MAX }, () => Math.random()))
  const [isScores, setIsScores] = useState(false)
  const listing = useFighterListing()
  const hasScores = leaderboard.length > 0
  const shown = Math.min(CROWD_MAX, singerCount)

  // every fighter on disk, once the listing lands; the shipped eight until then
  const crowd = useMemo(() => {
    const roster = Object.entries(listing)
      .flatMap(([group, slugs]) => Object.keys(slugs).map(slug => battleSingerAt(group, slug)))

    return crowdOf(seeds, roster.length ? roster : BATTLE_SINGERS)
  }, [listing, seeds])

  useEffect(() => {
    if (!hasScores) return

    const intervalID = setInterval(() => setIsScores(is => !is), SWAP_MS)
    return () => clearInterval(intervalID)
  }, [hasScores])

  if (hasScores && isScores) return <PlayerScores leaderboard={leaderboard} venue={roomName} />

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
        {crowd.map((member, k) => (
          <img
            key={k}
            className={clsx(styles.member, k >= shown && styles.away)}
            src={battleSingerFrontArt(member.singer).url}
            alt=''
            style={{ '--row': member.row, '--x': member.x } as React.CSSProperties}
          />
        ))}
      </div>
      <div className={styles.join}>
        <img className={styles.logo} src='assets/arcade/logo.svg' alt='KaraokeArcade' />
        <span className={styles.headline}>Scan to sing</span>
        <div className={styles.codeRow}>
          {qr}
          <div className={styles.code}>
            {roomName && (
              <>
                <span className={styles.codeLabel}>Room code</span>
                <span className={styles.codeValue} translate='no'>{roomName}</span>
              </>
            )}
            <span className={styles.blink}>Insert token</span>
            <span className={styles.joinCount}>{joinCountOf(singerCount)}</span>
          </div>
        </div>
        {/* undesigned and needed (U-23): browsers won't autoplay without a tap */}
        {isIdle && (
          <Button variant='primary' cta className={styles.playKey} onClick={() => dispatch(requestPlay())}>
            Play
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
