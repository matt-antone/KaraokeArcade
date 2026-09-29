import React from 'react'
import clsx from 'clsx'
import Hud from 'components/Header/Hud/Hud'
import { useAppSelector } from 'store/hooks'
import useNow from 'lib/useNow'
import { formatDuration } from 'lib/dateTime'
import styles from './BattleFrame.css'

/**
 * The phone every battle screen is drawn on (Arcade Flow v2 2d): a full-screen
 * takeover on the deep ground, the 4px bar across the top in the colour the
 * screen is about, and the HUD row — Battle, the venue, and one word saying
 * what this screen is doing.
 *
 * 13a and 13b draw their own header instead, and pass no status; 13h and 13h2
 * have no bar. The CRT wash is global.css's, over everything.
 */

export type BattleTone = 'gold' | 'red' | 'green' | 'mint' | 'grey'

interface BattleFrameProps {
  /** The 4px bar across the top, or none. */
  bar?: BattleTone
  /** The HUD's right-hand word ('Sent', 'Voting', 'Result'…), or no HUD. */
  status?: string
  statusTone?: BattleTone
  children: React.ReactNode
}

const BattleFrame = ({ bar, status, statusTone = 'mint', children }: BattleFrameProps) => {
  const venue = useAppSelector(state => (
    state.user.roomId == null ? undefined : state.rooms.entities[state.user.roomId]?.name
  ))

  return (
    <div className={styles.screen}>
      {bar && <div className={clsx(styles.bar, styles[bar])} />}

      {status && (
        <Hud
          left={<span className={styles.goldInk}>Battle</span>}
          room={venue}
          right={<span className={styles[`${statusTone}Ink`]}>{status}</span>}
        />
      )}

      {children}
    </div>
  )
}

/** m:ss to a server deadline (an invite's expiresAt). Its own component so
 *  only the numeral re-renders on the tick, not the screen around it. */
export const BattleClock = ({ endsAt, className }: { endsAt: number, className?: string }) => {
  const now = useNow()

  return <span className={className}>{formatDuration(Math.ceil(Math.max(0, endsAt - now) / 1000))}</span>
}

export default BattleFrame
