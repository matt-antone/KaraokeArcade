import React, { useRef, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { requestLogout, updateAccount } from 'store/modules/user'
import { showErrorMessage } from 'store/modules/ui'
import { removeItem } from 'routes/Queue/modules/queue'
import getUpcoming from 'routes/Queue/selectors/getUpcoming'
import Panel from 'components/Panel/Panel'
import Button from 'components/Button/Button'
import useConfirm from 'components/Modal/useConfirm'
import AccountForm from '../AccountForm/AccountForm'
import styles from './Account.css'

const Account = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector(state => state.user)
  const upcomingQueueIds = useAppSelector(state => getUpcoming(state, user.userId))

  const curPassword = useRef(null)
  const [isDirty, setDirty] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  const handleSignOut = async () => {
    if (!user.isAdmin) {
      const hasUpcomingSongs = upcomingQueueIds.length > 0
      let message = ''

      if (user.isGuest && hasUpcomingSongs) {
        message = `Are you sure you want to sign out?\n\nYour upcoming songs will be removed from the queue, and as a guest, you won't be able to sign back into this account.`
      } else if (user.isGuest) {
        message = `Are you sure you want to sign out?\n\nAs a guest, you won't be able to sign back into this account.`
      } else if (hasUpcomingSongs) {
        message = `Are you sure you want to sign out?\n\nYour upcoming songs will be removed from the queue.`
      }

      if (message && !await confirm({
        title: 'Sign out',
        confirmLabel: 'Sign out',
        message,
      })) return

      if (hasUpcomingSongs) {
        dispatch(removeItem({ queueId: upcomingQueueIds }))
      }
    }

    dispatch(requestLogout())
    navigate('/', { replace: true })
  }

  const handleSubmit = (data: FormData) => {
    if (!user.isGuest) {
      if (!curPassword.current.value.trim()) {
        // The app's own fault panel rather than window.alert, which an
        // embedded or managed browser suppresses outright — the form would
        // simply refuse to submit with nothing said about why.
        dispatch(showErrorMessage('Please enter your current password to make changes.'))
        curPassword.current.focus()
        return
      }

      data.append('password', curPassword.current.value)
    }

    dispatch(updateAccount(data))
  }

  return (
    <Panel title='My Account'>
      <>
        <p className={clsx('silkscreen', styles.signedInAs)}>
          signed in as
          {' '}
          <strong>{user.isGuest ? 'guest' : user.username}</strong>
        </p>

        <AccountForm
          user={user}
          onDirtyChange={setDirty}
          onSubmit={handleSubmit}
          showUsername={!user.isGuest}
          showPassword={!user.isGuest}
        >
          {isDirty && !user.isGuest && (
            <input
              type='password'
              autoComplete='current-password'
              placeholder='current password'
              ref={curPassword}
            />

          )}

          <div className={styles.btnContainer}>
            {isDirty && (
              <Button type='submit' variant='primary'>
                Update Account
              </Button>
            )}
            <Button onClick={handleSignOut} variant='default'>
              Sign Out
            </Button>
          </div>
        </AccountForm>

        {confirmDialog}
      </>
    </Panel>
  )
}

export default Account
