import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { closeUserEditor, fetchUsers, filterByOnline, filterByRoom, openUserEditor, type UserWithRoomsAndRole } from '../../modules/users'
import { formatShortDate } from 'lib/dateTime'
import Panel from 'components/Panel/Panel'
import Button from 'components/Button/Button'
import EditUser from './EditUser/EditUser'
import getUsers from '../../selectors/getUsers'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import { HeadSelect } from '../PanelHead/PanelHead'
import styles from './Users.css'

const Users = () => {
  const [editorUser, setEditorUser] = useState<UserWithRoomsAndRole | null>(null)

  const curUserId = useAppSelector(state => state.user.userId)
  const { isEditorOpen, filterOnline, filterRoomId } = useAppSelector(state => state.users)
  const rooms = useAppSelector(state => state.rooms)
  const users = useAppSelector(getUsers)

  const dispatch = useAppDispatch()
  const handleClose = () => dispatch(closeUserEditor())
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'all') dispatch(filterByOnline(false))
    else if (e.target.value === 'online') dispatch(filterByOnline(true))
    else dispatch(filterByRoom(parseInt(e.target.value, 10)))
  }

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setEditorUser(users.entities[parseInt(e.currentTarget.dataset.userId)])
    dispatch(openUserEditor())
  }

  // once per mount
  useEffect(() => {
    dispatch(fetchUsers())
  }, [dispatch])

  const rows = users.result.map((userId) => {
    const user = users.entities[userId]

    return (
      <div key={userId} className={styles.row}>
        <UserAvatar className={styles.portrait} avatarId={user.avatarId} />
        {/* your own account is edited on the Me tab, not here */}
        {userId === curUserId
          ? <span className={styles.name} translate='no'>{user.name}</span>
          : (
              <button type='button' className={styles.name} translate='no' data-user-id={userId} onClick={handleOpen}>
                {user.name}
              </button>
            )}
        <span className={styles.role}>{user.role}</span>
        <span className={styles.date}>{formatShortDate(new Date(user.dateCreated * 1000))}</span>
      </div>
    )
  })

  const roomOpts = rooms.result
    .filter(roomId => !!rooms.entities[roomId].numUsers)
    .map(roomId => <option key={roomId} value={roomId}>{rooms.entities[roomId].name}</option>)

  const filterText = filterOnline
    ? 'Online'
    : (typeof filterRoomId === 'number' && rooms.entities[filterRoomId]?.name) || 'All'

  const userFilter = (
    <HeadSelect
      text={filterText}
      aria-label='Show users'
      onChange={handleFilterChange}
      value={filterOnline ? 'online' : filterRoomId || 'all'}
    >
      <option key='all' value='all'>All</option>
      <option key='online' value='online'>Online</option>
      <optgroup label='Online in...'>
        {roomOpts}
      </optgroup>
    </HeadSelect>
  )

  return (
    <Panel title='Users' titleComponent={userFilter} contentClassName={styles.content}>
      <>
        {rows}

        <div className={styles.create}>
          <Button onClick={handleOpen} variant='default'>
            Create user
          </Button>
        </div>

        {isEditorOpen && (
          <EditUser onClose={handleClose} user={editorUser} />
        )}
      </>
    </Panel>
  )
}

export default Users
