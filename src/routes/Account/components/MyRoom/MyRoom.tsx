import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { useNavigate } from 'react-router'
import { fetchRooms } from 'store/modules/rooms'
import { requestLogout, setRoom } from 'store/modules/user'
import { removeItem } from 'routes/Queue/modules/queue'
import getUpcoming from 'routes/Queue/selectors/getUpcoming'
import { myStanding } from 'store/selectors/points'
import { BATTLE_STAGE_PLATE, battleSingerOrDefault, battleSingerStage } from 'lib/battleSingers'
import Modal from 'components/Modal/Modal'
import { forgetInserted } from 'components/TokenGate/tokenInserted'
import Button from 'components/Button/Button'
import SelectRoom from '../SelectRoom/SelectRoom'
import styles from './MyRoom.css'

/** A fighter with no stage of their own stands on the dive bar. Guarded so a
 *  missing plate cannot loop the error handler. */
const fallBackToPlate = (e: React.SyntheticEvent<HTMLImageElement>) => {
  if (!e.currentTarget.src.endsWith(BATTLE_STAGE_PLATE)) e.currentTarget.src = BATTLE_STAGE_PLATE
}

/**
 * Which room you are in, and the way out of it (08 › Leave → 08c).
 *
 * The room is carried in the JWT, so leaving is signing out: the design's
 * Leave goes back to the token slot, and a singer who wants another room joins
 * it from there. The one exception is somebody with no room at all — an admin
 * is allowed to sign in without choosing one — who gets the same SelectRoom the
 * sign-in screen uses, because otherwise no screen would offer them a room.
 */
const MyRoom = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const rooms = useAppSelector(state => state.rooms)
  const user = useAppSelector(state => state.user)
  const upcomingQueueIds = useAppSelector(state => getUpcoming(state, user.userId))
  const { points } = useAppSelector(myStanding)
  const [isLeaving, setLeaving] = useState(false)

  const [roomId, setRoomId] = useState<number | null>(user.roomId)
  const [roomPassword, setRoomPassword] = useState('')

  // The list is whatever this account is allowed to see: /api/rooms gives an
  // admin every room and everybody else the playing ones plus their own.
  useEffect(() => {
    dispatch(fetchRooms())
  }, [dispatch])

  const currentRoom = typeof user.roomId === 'number' ? rooms.entities[user.roomId] : undefined

  const handleJoin = () => {
    if (roomId === null) return

    dispatch(setRoom({ roomId, roomPassword }))
    setRoomPassword('')
  }

  // Leaving clears a non-admin's queued songs, so the screen says how many.
  const removed = user.isAdmin ? 0 : upcomingQueueIds.length

  const handleLeave = () => {
    if (removed) dispatch(removeItem({ queueId: upcomingQueueIds }))
    dispatch(requestLogout())
    forgetInserted() // back to 01's slot, not 02
    navigate('/', { replace: true })
  }

  return (
    <>
      <div className={styles.row}>
        <span className={styles.heading}>My room</span>
        <span className={styles.current}>
          <span className={styles.roomName} translate='no'>{currentRoom ? currentRoom.name : 'No room'}</span>
          {currentRoom && (
            <button type='button' className={styles.leave} onClick={() => setLeaving(true)}>
              Leave
            </button>
          )}
        </span>
      </div>

      {/* 08c: a screen of its own, not a panel over 08 */}
      {isLeaving && currentRoom && (
        <Modal variant='screen' title={`Leave ${currentRoom.name}?`} onClose={() => setLeaving(false)}>
          <div className={styles.screen}>
            <img
              className={styles.location}
              src={battleSingerStage(battleSingerOrDefault(user.avatarId))}
              alt=''
              onError={fallBackToPlate}
            />
            <div className={styles.overlay} />
            <div className={styles.centre}>
              <div className={styles.card}>
                <span className={styles.title}>
                  LEAVE
                  <br />
                  <span translate='no'>{`${currentRoom.name.toUpperCase()}?`}</span>
                </span>
                <span className={styles.body}>
                  {`Your ${points} points stay on tonight’s board.`}
                  {removed > 0 && ` Your ${removed} queued ${removed === 1 ? 'song' : 'songs'} will be removed.`}
                </span>
                <Button variant='danger' cta onClick={handleLeave}>Leave room</Button>
                <Button variant='default' cta onClick={() => setLeaving(false)}>Stay</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* nobody is offered another room while they are in one: Leave is the
          way to change rooms */}
      {!currentRoom && (rooms.result.length === 0
        ? <p className={styles.empty}>No rooms are open right now.</p>
        : (
            <>
              <SelectRoom
                rooms={rooms}
                roomId={roomId}
                roomPassword={roomPassword}
                showAllRooms
                onRoomSelect={setRoomId}
                onRoomPasswordChange={setRoomPassword}
              />

              <Button variant='primary' cta disabled={roomId === null} onClick={handleJoin}>
                Join room
              </Button>
            </>
          ))}
    </>
  )
}

export default MyRoom
