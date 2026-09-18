import React from 'react'
import { useAppDispatch } from 'store/hooks'
import { createUser, removeUser, updateUser } from '../../../modules/users'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import useConfirm from 'components/Modal/useConfirm'
import AccountForm from 'routes/Account/components/AccountForm/AccountForm'
import { UserWithRole } from 'shared/types'
import styles from './EditUser.css'

interface EditUserProps {
  user?: UserWithRole
  onClose: () => void
}

const EditUser = ({ user, onClose }: EditUserProps) => {
  const dispatch = useAppDispatch()

  const handleSubmit = (data: FormData) => {
    if (user) dispatch(updateUser({ userId: user.userId, data }))
    else dispatch(createUser(data))
  }

  const [confirm, confirmDialog] = useConfirm()

  const handleRemoveClick = async () => {
    if (user && await confirm({
      title: 'Remove user',
      confirmLabel: 'Remove User',
      message: `Remove the user "${user.name}"?\n\nTheir account and every song they have queued are deleted. This cannot be undone.`,
    })) {
      dispatch(removeUser(user.userId))
    }
  }

  return (
    <Modal
      className={styles.modal}
      onClose={onClose}
      title={user ? user.name : 'Create User'}
    >
      <AccountForm user={user} onSubmit={handleSubmit} showRole autoFocus={!user}>
        <div className={styles.btnContainer}>
          {!user && (
            <Button type='submit' className={styles.btn} variant='primary'>
              Create User
            </Button>
          )}

          {user && (
            <Button type='submit' className={styles.btn} variant='primary'>
              Update User
            </Button>
          )}

          {user && (
            <Button onClick={handleRemoveClick} className={styles.btn} variant='danger'>
              Remove User
            </Button>
          )}

          <Button onClick={onClose} variant='default'>
            Cancel
          </Button>
        </div>
      </AccountForm>

      {confirmDialog}
    </Modal>
  )
}

export default EditUser
