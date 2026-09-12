import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { fetchRooms } from 'store/modules/rooms'
import { setRoom } from 'store/modules/user'
import Panel from 'components/Panel/Panel'
import Button from 'components/Button/Button'
import SelectRoom from '../SelectRoom/SelectRoom'
import styles from './MyRoom.css'

/**
 * Which room you are in, and how to be in a different one.
 *
 * Choosing a room used to happen once, on the way in, and never again: the
 * room is carried in the JWT, so the only way to change it was to sign out and
 * back in. That is a nuisance for a singer moving between rooms and a dead end
 * for an admin, who is deliberately allowed to sign in without choosing one at
 * all — they landed in the app with no room, every song tap refused, and no
 * screen anywhere offering them a room to join.
 *
 * The same SelectRoom the sign-in screen uses, for the same reason it is a
 * component: a room with a password has to ask for it in both places, and two
 * lists of rooms would disagree about which rooms are on offer.
 */
const MyRoom = () => {
  const dispatch = useAppDispatch()
  const rooms = useAppSelector(state => state.rooms)
  const currentRoomId = useAppSelector(state => state.user.roomId)

  const [roomId, setRoomId] = useState<number | null>(currentRoomId)
  const [roomPassword, setRoomPassword] = useState('')

  // The list is whatever this account is allowed to see: /api/rooms gives an
  // admin every room and everybody else the playing ones plus their own.
  useEffect(() => {
    dispatch(fetchRooms())
  }, [dispatch])

  const currentRoom = typeof currentRoomId === 'number' ? rooms.entities[currentRoomId] : undefined
  const isChanged = roomId !== null && roomId !== currentRoomId

  const handleJoin = () => {
    if (roomId === null) return

    dispatch(setRoom({ roomId, roomPassword }))
    setRoomPassword('')
  }

  return (
    <Panel title='My Room'>
      <>
        <p className='silkscreen'>
          {currentRoom
            ? 'you are in'
            : 'you are not in a room'}
          {currentRoom && (
            <>
              {' '}
              <strong translate='no'>{currentRoom.name}</strong>
            </>
          )}
        </p>

        {rooms.result.length === 0
          ? (
              // Distinct from "you are not in a room": there is nothing to join,
              // and a blank list under a heading reads as a screen that failed
              // to load rather than as a party that has not started.
              <p className={styles.empty}>No rooms are open right now.</p>
            )
          : (
              <>
                <SelectRoom
                  className={styles.rooms}
                  rooms={rooms}
                  roomId={roomId}
                  roomPassword={roomPassword}
                  showAllRooms
                  onRoomSelect={setRoomId}
                  onRoomPasswordChange={setRoomPassword}
                />

                <Button
                  variant='primary'
                  disabled={!isChanged}
                  onClick={handleJoin}
                >
                  {currentRoom ? 'Switch Room' : 'Join Room'}
                </Button>
              </>
            )}
      </>
    </Panel>
  )
}

export default MyRoom
