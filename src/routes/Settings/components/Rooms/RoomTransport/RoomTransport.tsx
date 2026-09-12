import React from 'react'
import clsx from 'clsx'
import { useAppDispatch } from 'store/hooks'
import Button from 'components/Button/Button'
import useConfirm from 'components/Modal/useConfirm'
import { setRoomStatus } from 'store/modules/rooms'
import type { RoomStatus } from 'shared/types'
import styles from './RoomTransport.css'

/**
 * One room's transport, in its row of the rooms list. Two keys: the running
 * key, which is whichever of play and pause the room is not currently doing,
 * and stop.
 *
 * The first key names what pressing it does rather than where the room is —
 * a playing room offers Pause, everything else offers Play. Three keys with
 * the current one lit read as a status column that could also be pressed, and
 * the two readings disagree about what the lit key means: the state you are
 * in, or the button you just used.
 *
 * The room's state is still legible, and takes no extra ink. Pause is lit
 * while the room is playing, stop is lit while it is stopped, and a paused
 * room lights neither — so the strip reads as a status column at a glance and
 * all three states stay apart without a word beside them.
 */
const RUNNING_KEY: Record<RoomStatus, { next: RoomStatus, icon: 'PLAY' | 'PAUSE', label: string }> = {
  play: { next: 'paused', icon: 'PAUSE', label: 'Pause' },
  paused: { next: 'play', icon: 'PLAY', label: 'Play' },
  stopped: { next: 'play', icon: 'PLAY', label: 'Play' },
}

interface RoomTransportProps {
  roomId: number
  name: string
  status: RoomStatus
}

const RoomTransport = ({ roomId, name, status }: RoomTransportProps) => {
  const dispatch = useAppDispatch()

  // Stop is the only key that throws anything away, so it is the only one that
  // asks. Pause is reversible and asking would make holding the room for an
  // announcement feel like a decision.
  const [confirm, confirmDialog] = useConfirm()

  const handleClick = async (next: RoomStatus) => {
    if (next === status) return

    if (next === 'stopped' && !await confirm({
      title: 'Stop room',
      confirmLabel: 'Stop the room',
      message: `Stop "${name}"?\n\nThe queue is emptied, paused singers are un-paused and every trivia score goes back to zero. Nobody's personal sung history is touched. This cannot be undone.`,
    })) {
      return
    }

    dispatch(setRoomStatus({ roomId, status: next }))
  }

  const running = RUNNING_KEY[status]
  const isPlaying = status === 'play'
  const isStopped = status === 'stopped'

  return (
    <div className={styles.container} role='group' aria-label={`${name} transport`}>
      {/* Lit while the room is playing, which is the one state worth spotting
          from across a list of rooms. Still a key you press, so it does not
          take .active's dead cursor the way a stopped room's stop key does. */}
      <Button
        className={styles.key}
        variant={isPlaying ? 'primary' : 'default'}
        icon={running.icon}
        onClick={() => handleClick(running.next)}
        aria-label={running.label}
      />
      <Button
        className={clsx(styles.key, isStopped && styles.active)}
        variant={isStopped ? 'primary' : 'default'}
        icon='STOP'
        onClick={() => handleClick('stopped')}
        aria-label='Stop'
        aria-pressed={isStopped}
      />

      {confirmDialog}
    </div>
  )
}

export default RoomTransport
