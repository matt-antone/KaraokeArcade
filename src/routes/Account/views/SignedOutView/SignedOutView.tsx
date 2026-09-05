import React, { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { fetchRooms } from 'store/modules/rooms'
import { createAccount, login } from 'store/modules/user'
import SelectRoom from '../../components/SelectRoom/SelectRoom'
import InputRadio from 'components/InputRadio/InputRadio'
import Button from 'components/Button/Button'
import AccountForm from '../../components/AccountForm/AccountForm'
import SignIn from './SignIn/SignIn'
import styles from './SignedOutView.css'

const SignedOutView = () => {
  const userSectionRef = useRef<HTMLDivElement | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)

  const prefs = useAppSelector(state => state.prefs)
  const rooms = useAppSelector(state => state.rooms)
  const dispatch = useAppDispatch()

  const [mode, setMode] = useState('returning')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [roomId, setRoomId] = useState<number | null>(null)
  const [roomPassword, setRoomPassword] = useState('')
  const [showRoomSection, setShowRoomSection] = useState(false)
  const [showAllRooms, setShowAllRooms] = useState(true)
  const [prevRooms, setPrevRooms] = useState<typeof rooms | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)

  // once per mount
  useEffect(() => {
    dispatch(fetchRooms())
  }, [dispatch])

  // room selection visibility/defaults
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (rooms !== prevRooms) {
    setPrevRooms(rooms)
    const searchParams = new URLSearchParams(location.search)
    const roomIdParam = searchParams.get('roomId')
    const id = roomIdParam ? parseInt(roomIdParam, 10) : null
    const password = searchParams.get('password')

    if (id && rooms.entities[id]) {
      setRoomId(id)
      setShowAllRooms(false)

      if (rooms.entities[id]?.hasPassword) {
        if (password) {
          setRoomPassword(atob(password))
          setShowRoomSection(false)
          setFocusRequest(r => r + 1)
        } else {
          setShowRoomSection(true)
        }
      } else {
        setFocusRequest(r => r + 1)
      }
    } else if (rooms.result.length === 1) {
      setRoomId(rooms.result[0])
      setShowRoomSection(rooms.entities[rooms.result[0]]?.hasPassword)
    } else {
      setShowRoomSection(rooms.result.length !== 0)
    }
  }

  const handleRoomSelect = (id: number) => {
    setRoomId(id)
    setMode('returning')

    if (!rooms.entities[id]?.hasPassword || !showRoomSection) {
      setFocusRequest(r => r + 1)
      userSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleFirstFieldRef = (el: HTMLInputElement | null) => {
    if (el) firstFieldRef.current = el
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()

    dispatch(login({
      username: username.trim(),
      password: password,
      roomId,
      roomPassword,
    }))
  }

  const handleCreate = (data: FormData) => {
    data.append('roomId', String(roomId))
    data.append('roomPassword', roomPassword)

    if (mode !== 'returning') {
      data.append('role', mode)
    }

    dispatch(createAccount(data))
  }

  const getAllowed = (roleName: string) => {
    const roleId = prefs.roles.result.find(id => prefs.roles.entities[id].name === roleName)
    return !!rooms.entities[roomId]?.prefs?.roles?.[roleId]?.allowNew
  }

  const allowNewGuest = getAllowed('guest')
  const allowNewStandard = getAllowed('standard')
  const allowNew = allowNewStandard || allowNewGuest

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [focusRequest, mode])

  return (
    <div className={styles.container}>
      {showRoomSection && (
        <>
          <h2 className={clsx('silkscreen', styles.heading)}>join room</h2>
          <SelectRoom
            rooms={rooms}
            roomId={roomId}
            roomPassword={roomPassword}
            showAllRooms={showAllRooms}
            onRoomSelect={handleRoomSelect}
            onRoomPasswordChange={setRoomPassword}
          />
        </>
      )}

      <div ref={userSectionRef} className={clsx(rooms.result.length > 1 && roomId === null && styles.hidden)}>
        {allowNew
          ? (
              <>
                <h2 className={clsx('silkscreen', styles.heading)}>join as</h2>
                <div className={styles.radioContainer}>
                  <InputRadio name='type' value='returning' checked={mode === 'returning'} onChange={setMode} label='Returning user' />
                  {allowNewStandard && <InputRadio name='type' value='standard' checked={mode === 'standard'} onChange={setMode} label='New user' />}
                  {allowNewGuest && <InputRadio name='type' value='guest' checked={mode === 'guest'} onChange={setMode} label='Guest' />}
                </div>
              </>
            )
          : <h2 className={clsx('silkscreen', styles.heading)}>sign in</h2>}

        {(mode === 'returning' || !allowNew) && (
          <SignIn
            username={username}
            password={password}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onSubmit={handleLogin}
            onFirstFieldRef={handleFirstFieldRef}
          />
        )}

        {mode !== 'returning' && allowNew && (
          <AccountForm
            showUsername={mode !== 'guest'}
            showPassword={mode !== 'guest'}
            onSubmit={handleCreate}
            onFirstFieldRef={handleFirstFieldRef}
          >
            <Button type='submit' variant='primary'>
              {mode === 'guest' ? 'Join as Guest' : 'Create Account'}
            </Button>
          </AccountForm>
        )}
      </div>
    </div>
  )
}

export default SignedOutView
