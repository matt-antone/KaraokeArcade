import React, { useEffect, useMemo, useState } from 'react'
import { BATTLE_SINGERS, battleSingerAt, battleSingerFrontArt } from 'lib/battleSingers'
import { useFighterListing } from 'lib/fighterSets'
import type { LeaderboardEntry } from 'shared/types'
import PlayerScores from '../PlayerScores/PlayerScores'
import { CROWD_MAX, crowdOf } from './crowd'
import styles from './PlayerJoin.css'

/** How long each of the two idle screens holds before handing to the other. */
const SWAP_MS = 20000

interface PlayerJoinProps {
  /** The room's name, standing in for the design's room code. */
  roomName?: string
  /** The docked join code, when the room is showing one. */
  qr?: React.ReactNode
  leaderboard: LeaderboardEntry[]
}

/**
 * 10 · The TV between songs: how to join on the left, the crowd on the right.
 *
 * Once anyone has scored tonight the screen takes turns with 14 · Tonight's
 * scores — the idle stage is the one slot where the leaderboard interrupts
 * nothing, and the room is standing around waiting anyway.
 */
const PlayerJoin = ({ roomName, qr, leaderboard }: PlayerJoinProps) => {
  // Drawn once per mount, so the crowd holds still across every re-render.
  const [seeds] = useState(() => Array.from({ length: CROWD_MAX }, () => Math.random()))
  const [isScores, setIsScores] = useState(false)
  const listing = useFighterListing()
  const hasScores = leaderboard.length > 0

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
      <div className={styles.crowd} aria-hidden>
        {crowd.map((member, k) => (
          <img
            key={k}
            className={styles.member}
            src={battleSingerFrontArt(member.singer).url}
            alt=''
            style={{ '--row': member.row, '--x': member.x } as React.CSSProperties}
          />
        ))}
      </div>
      <div className={styles.panel} />
      <div className={styles.join}>
        <img className={styles.logo} src='assets/arcade/logo.svg' alt='KaraokeArcade' />
        <span className={styles.headline}>Scan to sing</span>
        <div className={styles.codeRow}>
          {qr}
          <div className={styles.code}>
            {roomName && (
              <>
                <span className={styles.codeLabel}>Room</span>
                <span className={styles.codeValue} translate='no'>{roomName}</span>
              </>
            )}
            <span className={styles.blink}>Insert token</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlayerJoin
