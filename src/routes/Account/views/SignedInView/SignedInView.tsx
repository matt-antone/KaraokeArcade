import React, { useEffect } from 'react'
import { useAppDispatch } from 'store/hooks'
import { fetchAccount } from 'store/modules/user'
import Account from '../../components/Account/Account'
import MyRoom from '../../components/MyRoom/MyRoom'
import SongHistory from '../../components/SongHistory/SongHistory'
import styles from './SignedInView.css'

const SignedInView = () => {
  const dispatch = useAppDispatch()

  // once per mount
  useEffect(() => {
    (async () => dispatch(fetchAccount()))()
  }, [dispatch])

  return (
    <>
      <Account />
      {/* 08 draws the room and the history as one column: which room you are
          in is a fact about this session, and what you sang in it follows. */}
      <section className={styles.column}>
        <MyRoom />
        <SongHistory />
      </section>
    </>
  )
}

export default SignedInView
