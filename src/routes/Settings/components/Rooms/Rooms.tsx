import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Panel from 'components/Panel/Panel'
import Button from 'components/Button/Button'
import EditRoom from './EditRoom/EditRoom'
import RoomTransport from './RoomTransport/RoomTransport'
import { closeRoomEditor, fetchRooms, filterByStatus, openRoomEditor } from 'store/modules/rooms'
import { filterByRoom } from '../../modules/users'
import getRoomList from '../../selectors/getRoomList'
import { HeadSelect } from '../PanelHead/PanelHead'
import styles from './Rooms.css'

const Rooms = () => {
  const [editorRoom, setEditorRoom] = useState(null)

  const { isEditorOpen, filterStatus } = useAppSelector(state => state.rooms)
  const rooms = useAppSelector(getRoomList)

  const dispatch = useAppDispatch()
  const handleClose = () => dispatch(closeRoomEditor())
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.currentTarget.value === 'all') dispatch(filterByStatus(false))
    else dispatch(filterByStatus(e.currentTarget.value))
  }
  const handleFilterUsers = (e: React.MouseEvent<HTMLElement>) => dispatch(filterByRoom(parseInt(e.currentTarget.dataset.roomId)))
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setEditorRoom(rooms.entities[parseInt(e.currentTarget.dataset.roomId || '0')])
    dispatch(openRoomEditor())
  }

  // once per mount
  useEffect(() => {
    dispatch(fetchRooms())
  }, [dispatch])

  const rows = rooms.result.map((roomId) => {
    const room = rooms.entities[roomId]
    return (
      <div key={String(roomId)} className={styles.row}>
        <button type='button' className={styles.name} translate='no' data-room-id={roomId} onClick={handleOpen}>
          {room.name}
        </button>
        <RoomTransport roomId={roomId} name={room.name} status={room.status} />
        {/* the slot holds its width so the transports line up */}
        <span className={styles.count}>
          {room.numUsers > 0
            ? (
                <button type='button' data-room-id={roomId} onClick={handleFilterUsers} aria-label={`Show users in ${room.name}`}>
                  {room.numUsers}
                </button>
              )
            : room.numUsers}
        </span>
      </div>
    )
  })

  const statusText = { play: 'Playing', paused: 'Paused', stopped: 'Stopped' }

  const roomsFilter = (
    <HeadSelect
      text={filterStatus === false ? 'All' : statusText[filterStatus as keyof typeof statusText] ?? 'All'}
      aria-label='Show rooms'
      onChange={handleFilterChange}
      value={filterStatus === false ? 'all' : filterStatus as string}
    >
      <option key='all' value='all'>All</option>
      <option key='play' value='play'>Playing</option>
      <option key='paused' value='paused'>Paused</option>
      <option key='stopped' value='stopped'>Stopped</option>
    </HeadSelect>
  )

  return (
    <Panel title='Rooms' titleComponent={roomsFilter} contentClassName={styles.content}>
      <>
        {/* No header row: a name, a transport that names its own keys, and a
            count are each self-evident. */}
        {rows}

        <div className={styles.create}>
          <Button onClick={handleOpen} variant='default'>
            Create room
          </Button>
        </div>

        {isEditorOpen && <EditRoom onClose={handleClose} room={editorRoom} />}
      </>
    </Panel>
  )
}

export default Rooms
