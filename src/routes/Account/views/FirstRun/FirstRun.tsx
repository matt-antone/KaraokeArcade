import React from 'react'
import { useAppDispatch } from 'store/hooks'
import { createAccount } from 'store/modules/user'
import Button from 'components/Button/Button'
import AccountForm from '../../components/AccountForm/AccountForm'
import styles from './FirstRun.css'

const FirstRun = () => {
  const dispatch = useAppDispatch()
  const handleCreate = (data: FormData) => {
    dispatch(createAccount(data))
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>First run</h1>
      <p className={styles.blurb}>
        Create your admin account to get started. All data is stored locally and
        never shared.
      </p>
      <AccountForm onSubmit={handleCreate} autoFocus>
        <Button variant='primary' type='submit'>
          Create Account
        </Button>
      </AccountForm>
    </div>
  )
}

export default FirstRun
