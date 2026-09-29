import React from 'react'
import { useAppDispatch } from 'store/hooks'
import { createAccount } from 'store/modules/user'
import Hud from 'components/Header/Hud/Hud'
import StartButton from 'components/StartButton/StartButton'
import AccountForm from '../../components/AccountForm/AccountForm'
import styles from './FirstRun.css'

/** Served by koa-static off the assets dir, relative so it follows <base href>. */
const LOGO = 'assets/arcade/logo.svg'

/** The admin account, before there is a room. No artboard of its own, so it
 *  is drawn as 02 Join as for a New user: HUD, logo, heading, the wells, and
 *  the start button pinned to the foot. */
const FirstRun = () => {
  const dispatch = useAppDispatch()
  const handleCreate = (data: FormData) => {
    dispatch(createAccount(data))
  }

  return (
    <div className={styles.screen}>
      <Hud />
      <img className={styles.logo} src={LOGO} alt='KaraokeArcade' />
      <h1 className={styles.heading}>First run</h1>
      <p className={styles.blurb}>
        Create your admin account to get started. All data is stored locally and
        never shared.
      </p>
      <AccountForm onSubmit={handleCreate}>
        <div className={styles.spacer} />
        <div className={styles.cta}>
          <StartButton sub='Create' />
        </div>
      </AccountForm>
    </div>
  )
}

export default FirstRun
