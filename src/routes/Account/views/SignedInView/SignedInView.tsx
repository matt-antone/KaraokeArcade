import React, { useEffect } from 'react'
import { useAppDispatch } from 'store/hooks'
import { fetchAccount } from 'store/modules/user'
import Account from '../../components/Account/Account'
import MyRoom from '../../components/MyRoom/MyRoom'
import SongHistory from '../../components/SongHistory/SongHistory'

const SignedInView = () => {
  const dispatch = useAppDispatch()

  // once per mount
  useEffect(() => {
    (async () => dispatch(fetchAccount()))()
  }, [dispatch])

  return (
    <>
      <Account />
      {/* Between the account and the history: which room you are in is a fact
          about this session, like the account above it, and the thing somebody
          reaches for when the app says they are not in one. */}
      <MyRoom />
      <SongHistory />
    </>
  )
}

export default SignedInView
