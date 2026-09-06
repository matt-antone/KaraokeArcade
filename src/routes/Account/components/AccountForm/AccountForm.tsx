import React, { useEffect, useRef, useState } from 'react'
import InputImage from 'components/InputImage/InputImage'
import { UserWithRole } from 'shared/types'
import styles from './AccountForm.css'

interface AccountFormProps {
  autoFocus?: boolean
  children?: React.ReactNode
  onDirtyChange?(isDirty: boolean): void
  onFirstFieldRef?(el: HTMLInputElement | null): void
  onSubmit(formData: FormData): void
  showRole?: boolean
  showUsername?: boolean
  showPassword?: boolean
  user?: UserWithRole
}

/** Only the fields that were actually filled in. Empty strings are left out
 *  rather than sent as empties: the update route treats an absent field as
 *  "unchanged" and a present one as "set to this". */
const buildFormData = (fields: {
  name?: string
  username?: string
  newPassword?: string
  newPasswordConfirm?: string
  image?: Blob
  role?: string
}): FormData => {
  const data = new FormData()

  if (fields.name?.trim()) data.append('name', fields.name.trim())
  if (fields.username?.trim()) data.append('username', fields.username.trim())

  if (fields.newPassword !== undefined) {
    data.append('newPassword', fields.newPassword)
    data.append('newPasswordConfirm', fields.newPasswordConfirm ?? '')
  }

  if (fields.image !== undefined) data.append('image', fields.image)
  if (fields.role !== undefined) data.append('role', fields.role)

  return data
}

/** Whether anything on the form differs from the account behind it. A new
 *  username or password counts by existing at all; the name and the role count
 *  only when they have moved. */
const isFormDirty = (
  user: { name: string, isAdmin: boolean },
  values: { username?: string, newPassword?: string, name?: string, role?: string },
): boolean => !!values.username
  || !!values.newPassword
  || values.name !== user.name
  || (values.role !== undefined && values.role !== (user.isAdmin ? '1' : '0'))

/** The password pair. The confirm only appears once something has been typed
 *  into the first, so a form nobody is changing the password on stays short. */
const PasswordFields = ({ isExisting, isChangingPassword, show, onChange, newPasswordRef, confirmRef }: {
  isExisting: boolean
  isChangingPassword: boolean
  show: boolean
  onChange: () => void
  newPasswordRef: React.RefObject<HTMLInputElement | null>
  confirmRef: React.RefObject<HTMLInputElement | null>
}) => {
  if (!show) return null

  return (
    <>
      <input
        type='password'
        autoComplete='new-password'
        onChange={onChange}
        placeholder={isExisting ? 'change password (optional)' : 'password'}
        ref={newPasswordRef}
      />

      {isChangingPassword && (
        <input
          type='password'
          autoComplete='new-password'
          placeholder={isExisting ? 'confirm new password' : 'confirm password'}
          ref={confirmRef}
        />
      )}
    </>
  )
}

/** Admin-only. Guest is offered only to an account that already is one:
 *  it is a role you can keep, not one you can be promoted into. */
const RoleSelect = ({ user, onChange, selectRef }: {
  user?: { role?: string }
  onChange: () => void
  selectRef: React.RefObject<HTMLSelectElement | null>
}) => (
  <select defaultValue={user?.role} onChange={onChange} ref={selectRef}>
    <option key='choose' value='' disabled>select role...</option>
    {user?.role === 'guest' && <option key='guest' value='guest'>Guest</option>}
    <option key='standard' value='standard'>Standard</option>
    <option key='admin' value='admin'>Administrator</option>
  </select>
)

const AccountForm = ({
  autoFocus,
  children,
  onDirtyChange,
  onFirstFieldRef,
  onSubmit,
  showRole,
  showUsername = true,
  showPassword = true,
  user,
}: AccountFormProps) => {
  const username = useRef<HTMLInputElement>(null)
  const newPassword = useRef<HTMLInputElement>(null)
  const newPasswordConfirm = useRef<HTMLInputElement>(null)
  const name = useRef<HTMLInputElement>(null)
  const role = useRef<HTMLSelectElement>(null)
  const [prevDateUpdated, setPrevDateUpdated] = useState(user?.dateUpdated)
  const [state, setState] = useState({
    isDirty: false,
    isChangingPassword: !user || user.userId === null,
    userImage: undefined as Blob | undefined,
  })

  const prevIsDirty = useRef(state.isDirty)

  // An account that already exists is being *changed*, so every field reads as
  // optional; a new one is being filled in. The only difference between the two
  // sets of placeholders.
  const isExisting = !!user && user.userId !== null

  if (user && user.dateUpdated !== prevDateUpdated) {
    setPrevDateUpdated(user.dateUpdated)
    setState(prev => ({ ...prev, isDirty: false }))
  }

  useEffect(() => {
    if (onDirtyChange && prevIsDirty.current !== state.isDirty) {
      onDirtyChange(state.isDirty)
    }

    prevIsDirty.current = state.isDirty
  }, [state.isDirty, onDirtyChange])

  const updateDirty = () => {
    if (!user || user.userId === null) return

    setState(prev => ({
      ...prev,
      isDirty: isFormDirty(user, {
        username: username.current?.value,
        newPassword: newPassword.current?.value,
        name: name.current?.value,
        role: role.current?.value,
      }),
      isChangingPassword: !!newPassword.current?.value,
    }))
  }

  const handleUserImageChange = (blob: Blob) => {
    setState(prev => ({
      ...prev,
      userImage: blob,
      isDirty: true,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    onSubmit(buildFormData({
      name: name.current?.value,
      username: username.current?.value,
      newPassword: state.isChangingPassword ? newPassword.current?.value ?? '' : undefined,
      newPasswordConfirm: state.isChangingPassword ? newPasswordConfirm.current?.value ?? '' : undefined,
      image: state.userImage,
      role: role.current?.value,
    }))
  }

  return (
    <form
      className={styles.container}
      key={user?.dateUpdated}
      noValidate
      onSubmit={handleSubmit}
    >
      <div className={styles.userDisplayContainer}>
        <InputImage
          user={user}
          onSelect={handleUserImageChange}
        />
        <input
          type='text'
          defaultValue={user?.name ?? ''}
          onChange={updateDirty}
          placeholder='display name'
          ref={(r) => {
            name.current = r
            if (!showUsername) onFirstFieldRef?.(r)
          }}
        />
      </div>

      {showUsername && (
        <input
          type='email'
          autoComplete='off'
          autoFocus={autoFocus}
          onChange={updateDirty}
          placeholder={isExisting ? 'change username (optional)' : 'username or email'}
          // https://github.com/facebook/react/issues/23301
          ref={(r) => {
            if (r) username.current = r
            if (autoFocus) r?.setAttribute('autofocus', 'true')
            onFirstFieldRef?.(r)
          }}
        />
      )}

      <PasswordFields
        isExisting={isExisting}
        isChangingPassword={state.isChangingPassword}
        show={showPassword}
        onChange={updateDirty}
        newPasswordRef={newPassword}
        confirmRef={newPasswordConfirm}
      />

      {showRole && <RoleSelect user={user} onChange={updateDirty} selectRef={role} />}

      {children}
    </form>
  )
}

export default AccountForm
