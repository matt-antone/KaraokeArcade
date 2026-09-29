import React, { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { fetchRooms } from 'store/modules/rooms'
import { createAccount, login } from 'store/modules/user'
import SelectRoom from '../../components/SelectRoom/SelectRoom'
import Hud from 'components/Header/Hud/Hud'
import StartButton from 'components/StartButton/StartButton'
import TokenGate from 'components/TokenGate/TokenGate'
import { isTokenInserted } from 'components/TokenGate/tokenInserted'
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
} => {
  const params = new URLSearchParams(search)
  const roomIdParam = params.get('roomId')
  const id = roomIdParam ? parseInt(roomIdParam, 10) : null
  const password = params.get('password')

  // a QR link naming a room: that room, and no list to choose from
  if (id && rooms.entities[id]) {
    if (!rooms.entities[id]?.hasPassword) {
      return { roomId: id, showAllRooms: false }
    }

    // the link carried the password too, so there is nothing left to ask
    if (password) {
      return { roomId: id, showAllRooms: false, roomPassword: atob(password), showRoomSection: false }
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
  },
) => {
  if (next.roomId !== undefined) set.setRoomId(next.roomId)
  if (next.roomPassword !== undefined) set.setRoomPassword(next.roomPassword)
  if (next.showAllRooms !== undefined) set.setShowAllRooms(next.showAllRooms)
  if (next.showRoomSection !== undefined) set.setShowRoomSection(next.showRoomSection)
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

/** The ways in, and what the start button does under its label for each. */
const MODES = [
  { mode: 'returning', label: 'Returning user', start: 'Sign in' },
  { mode: 'standard', label: 'New user', start: 'Create' },
  { mode: 'guest', label: 'Guest', start: 'Play as guest' },
]

/** Served by koa-static off the assets dir, relative so it follows <base href>. */
const LOGO = 'assets/arcade/logo.svg'

/** The ways in. Always headed "Join as"; a room that admits no new accounts
 *  offers only Returning user. The pick wears the yellow frame and the cursor,
 *  like a menu on a cabinet. */
const JoinAs = ({ mode, onModeChange, allowNewGuest, allowNewStandard }: {
  mode: string
  onModeChange: (mode: string) => void
  allowNewGuest: boolean
  allowNewStandard: boolean
}) => {
  const offered = MODES.filter(m => m.mode === 'returning'
    || (m.mode === 'standard' && allowNewStandard)
    || (m.mode === 'guest' && allowNewGuest))

  return (
    <>
      <h2 className={styles.heading}>Join as</h2>
      <div className={styles.modes}>
        {offered.map(m => (
          <button
            key={m.mode}
            type='button'
            aria-pressed={mode === m.mode}
            className={clsx(styles.mode, mode === m.mode && styles.modeOn)}
            onClick={() => onModeChange(m.mode)}
          >
            <span className={styles.cursor} aria-hidden='true' />
            {m.label}
          </button>
        ))}
      </div>
    </>
  )
}

const SignedOutView = () => {
  const userSectionRef = useRef<HTMLDivElement | null>(null)

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
  const [isResetting, setIsResetting] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(isTokenInserted)

  // once per mount
  useEffect(() => {
    dispatch(fetchRooms())
  }, [dispatch])

  // room selection visibility/defaults
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (rooms !== prevRooms) {
    setPrevRooms(rooms)
    applyRoomDefaults(roomDefaults(rooms, location.search), {
      setRoomId, setRoomPassword, setShowAllRooms, setShowRoomSection,
    })
  }

  const handleRoomSelect = (id: number) => {
    setRoomId(id)
    setMode('returning')

    if (!rooms.entities[id]?.hasPassword || !showRoomSection) {
      userSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
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
  const venue = roomId === null ? undefined : rooms.entities[roomId]?.name

  // 02b ends by signing in on the new password, into the room this screen
  // already resolved; a refusal leaves both filled in on the sign-in form
  const handleReset = (name: string, newPassword: string) => {
    setUsername(name)
    setPassword(newPassword)
    setIsResetting(false)
    dispatch(login({ username: name, password: newPassword, roomId, roomPassword }))
  }

  if (!isUnlocked) {
    return <TokenGate room={venue} onUnlock={() => setIsUnlocked(true)} />
  }

  // 02b is its own screen: the HUD and its own title, no logo
  if (isResetting && (mode === 'returning' || !allowNew)) {
    return (
      <div className={styles.screen}>
        <Hud room={venue} />
        <ResetPassword
          initialUsername={username}
          onReset={handleReset}
          onBack={(name) => {
            setUsername(name)
            setIsResetting(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <Hud room={venue} />
      <img className={styles.logo} src={LOGO} alt='KaraokeArcade' />

      {/* undesigned but needed: a house with several rooms and no link, or a
          room behind a password, is chosen here before anybody joins it */}
      {showRoomSection && (
        <>
          <h2 className={styles.heading}>Join room</h2>
          <SelectRoom
            className={styles.rooms}
            rooms={rooms}
            roomId={roomId}
            roomPassword={roomPassword}
            showAllRooms={showAllRooms}
            onRoomSelect={handleRoomSelect}
            onRoomPasswordChange={setRoomPassword}
          />
        </>
      )}

      <div ref={userSectionRef} className={clsx(styles.join, rooms.result.length > 1 && roomId === null && styles.hidden)}>
        <JoinAs
          mode={mode}
          onModeChange={setMode}
          allowNewGuest={allowNewGuest}
          allowNewStandard={allowNewStandard}
        />

        {(mode === 'returning' || !allowNew) && (
          <SignIn
            username={username}
            password={password}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onSubmit={handleLogin}
            onForgotPassword={() => setIsResetting(true)}
          />
        )}

        {mode !== 'returning' && allowNew && (
          <div className={styles.create}>
            <AccountForm
              showUsername={mode !== 'guest'}
              showPassword={mode !== 'guest'}
              name={username}
              onNameChange={setUsername}
              onSubmit={handleCreate}
            >
              <div className={styles.spacer} />
              <div className={styles.cta}>
                <StartButton sub={MODES.find(m => m.mode === mode)?.start ?? ''} />
              </div>
            </AccountForm>
          </div>
        )}
      </div>
    </div>
  )
}

export default SignedOutView
