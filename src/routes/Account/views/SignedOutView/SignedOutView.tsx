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
import ResetPassword from './ResetPassword/ResetPassword'
import styles from './SignedOutView.css'

/**
 * Which room the sign-in screen should open on, and how much of the room
 * section to show.
 *
 * A pure function of the room list and the query string, returning only the
 * pieces that change, so the render below applies setters rather than nesting
 * them three deep inside branch after branch. The four cases are: a room named
 * in the link, that link also carrying its password, exactly one room to pick,
 * and everything else.
 */
const roomDefaults = (
  rooms: { result: number[], entities: Record<number, { hasPassword?: boolean }> },
  search: string,
): {
  roomId?: number
  roomPassword?: string
  showAllRooms?: boolean
  showRoomSection?: boolean
  focus?: boolean
} => {
  const params = new URLSearchParams(search)
  const roomIdParam = params.get('roomId')
  const id = roomIdParam ? parseInt(roomIdParam, 10) : null
  const password = params.get('password')

  // a QR link naming a room: that room, and no list to choose from
  if (id && rooms.entities[id]) {
    if (!rooms.entities[id]?.hasPassword) {
      return { roomId: id, showAllRooms: false, focus: true }
    }

    // the link carried the password too, so there is nothing left to ask
    if (password) {
      return { roomId: id, showAllRooms: false, roomPassword: atob(password), showRoomSection: false, focus: true }
    }

    return { roomId: id, showAllRooms: false, showRoomSection: true }
  }

  // one room in the house: nothing to choose, but still something to unlock
  if (rooms.result.length === 1) {
    return { roomId: rooms.result[0], showRoomSection: rooms.entities[rooms.result[0]]?.hasPassword }
  }

  return { showRoomSection: rooms.result.length !== 0 }
}

/** Only the pieces roomDefaults actually decided. Its own function so the
 *  render is not five conditional setters deep in the middle of a component. */
const applyRoomDefaults = (
  next: ReturnType<typeof roomDefaults>,
  set: {
    setRoomId: (v: number) => void
    setRoomPassword: (v: string) => void
    setShowAllRooms: (v: boolean) => void
    setShowRoomSection: (v: boolean) => void
    setFocusRequest: (fn: (n: number) => number) => void
  },
) => {
  if (next.roomId !== undefined) set.setRoomId(next.roomId)
  if (next.roomPassword !== undefined) set.setRoomPassword(next.roomPassword)
  if (next.showAllRooms !== undefined) set.setShowAllRooms(next.showAllRooms)
  if (next.showRoomSection !== undefined) set.setShowRoomSection(next.showRoomSection)
  if (next.focus) set.setFocusRequest(r => r + 1)
}

/** Which kinds of new account this room admits. The room's prefs key the
 *  allowance by roleId, so the role names have to be resolved through the
 *  prefs slice before either question can be asked. */
const allowedRoles = (
  roles: { result: number[], entities: Record<number, { name: string }> },
  room?: { prefs?: { roles?: Record<number, { allowNew?: boolean }> } },
) => {
  const isAllowed = (roleName: string) => {
    const roleId = roles.result.find(id => roles.entities[id].name === roleName)

    return !!(roleId !== undefined && room?.prefs?.roles?.[roleId]?.allowNew)
  }

  const allowNewGuest = isAllowed('guest')
  const allowNewStandard = isAllowed('standard')

  return { allowNewGuest, allowNewStandard, allowNew: allowNewStandard || allowNewGuest }
}

/** The three ways in, or none of them: a room that admits no new accounts has
 *  nothing to choose between, so it gets a heading rather than a single radio. */
const JoinAs = ({ mode, onModeChange, allowNew, allowNewGuest, allowNewStandard }: {
  mode: string
  onModeChange: (mode: string) => void
  allowNew: boolean
  allowNewGuest: boolean
  allowNewStandard: boolean
}) => {
  if (!allowNew) return <h2 className={clsx('silkscreen', styles.heading)}>sign in</h2>

  return (
    <>
      <h2 className={clsx('silkscreen', styles.heading)}>join as</h2>
      <div className={styles.radioContainer}>
        <InputRadio name='type' value='returning' checked={mode === 'returning'} onChange={onModeChange} label='Returning user' />
        {allowNewStandard && <InputRadio name='type' value='standard' checked={mode === 'standard'} onChange={onModeChange} label='New user' />}
        {allowNewGuest && <InputRadio name='type' value='guest' checked={mode === 'guest'} onChange={onModeChange} label='Guest' />}
      </div>
    </>
  )
}

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
  const [isResetting, setIsResetting] = useState(false)

  // once per mount
  useEffect(() => {
    dispatch(fetchRooms())
  }, [dispatch])

  // room selection visibility/defaults
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (rooms !== prevRooms) {
    setPrevRooms(rooms)
    applyRoomDefaults(roomDefaults(rooms, location.search), {
      setRoomId, setRoomPassword, setShowAllRooms, setShowRoomSection, setFocusRequest,
    })
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

  const { allowNewGuest, allowNewStandard, allowNew } = allowedRoles(prefs.roles, rooms.entities[roomId])

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [focusRequest, mode, isResetting])

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
        <JoinAs
          mode={mode}
          onModeChange={setMode}
          allowNew={allowNew}
          allowNewGuest={allowNewGuest}
          allowNewStandard={allowNewStandard}
        />

        {(mode === 'returning' || !allowNew) && isResetting && (
          <ResetPassword
            initialUsername={username}
            onDone={(name) => {
              setUsername(name)
              setPassword('')
              setIsResetting(false)
            }}
            onFirstFieldRef={handleFirstFieldRef}
          />
        )}

        {(mode === 'returning' || !allowNew) && !isResetting && (
          <SignIn
            username={username}
            password={password}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onSubmit={handleLogin}
            onFirstFieldRef={handleFirstFieldRef}
            onForgotPassword={() => setIsResetting(true)}
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
