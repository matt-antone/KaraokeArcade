import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { requestLogout, updateAccount } from 'store/modules/user'
import { removeItem } from 'routes/Queue/modules/queue'
import getUpcoming from 'routes/Queue/selectors/getUpcoming'
import Panel from 'components/Panel/Panel'
import Modal from 'components/Modal/Modal'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import AvatarPicker from 'components/BattleStage/AvatarPicker'
import { battleSingerOrDefault } from 'lib/battleSingers'
import Button from 'components/Button/Button'
import useConfirm from 'components/Modal/useConfirm'
import AccountForm from '../AccountForm/AccountForm'
import styles from './Account.css'

const Account = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector(state => state.user)
  const upcomingQueueIds = useAppSelector(state => getUpcoming(state, user.userId))

  const leaderboard = useAppSelector(state => state.points.leaderboard)
  const myIndex = leaderboard.findIndex(entry => entry.userId === user.userId)
  const myPoints = myIndex >= 0 ? leaderboard[myIndex].points : 0

  const [isDirty, setDirty] = useState(false)
  const [isPicking, setPicking] = useState(false)
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
    dispatch(updateAccount(data))
  }

  const handleChooseSinger = (avatarId: string) => {
    const data = new FormData()
    data.append('avatarId', avatarId)
    void dispatch(updateAccount({ data, isSilent: true }))
    setPicking(false)
  }

  return (
    <>
      <section className={styles.hero}>
        <UserAvatar className={styles.portrait} avatarId={user.avatarId} size={80} />
        <div className={styles.who}>
          <span className={styles.label}>Signed in as</span>
          <span className={styles.name} translate='no'>{user.isGuest ? 'guest' : user.username}</span>
          <span className={styles.singer}>{battleSingerOrDefault(user.avatarId).name}</span>
        </div>
        <Button className={styles.change} variant='primary' onClick={() => setPicking(true)}>
          Change singer
        </Button>
      </section>

      <section className={styles.points}>
        <span className={styles.pointsLabel}>Points tonight</span>
        <span className={styles.pointsRank}>{myIndex >= 0 ? `#${myIndex + 1}` : '-'}</span>
        <span className={styles.pointsTotal}>{myPoints.toLocaleString()}</span>
      </section>

      {isPicking && (
        <Modal className={styles.modal} title='Your character' onClose={() => setPicking(false)}>
          <AvatarPicker avatarId={user.avatarId} onChoose={handleChooseSinger} />
        </Modal>
      )}

      <Panel title='Profile'>
        <>

          <AccountForm
            user={user}
            showAvatar={false}
            onDirtyChange={setDirty}
            onSubmit={handleSubmit}
            showUsername={!user.isGuest}
            showPassword={!user.isGuest}
          >
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
    </>
  )
}

export default Account
