import React, { useEffect, useRef, useState } from 'react'
import InputAvatar from 'components/InputAvatar/InputAvatar'
import { UserWithRole } from 'shared/types'
import { SECURITY_QUESTIONS } from 'shared/securityQuestions'
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
  avatarId?: string
  role?: string
  securityQuestion?: string
  securityAnswer?: string
}): FormData => {
  const data = new FormData()

  if (fields.name?.trim()) data.append('name', fields.name.trim())
  if (fields.username?.trim()) data.append('username', fields.username.trim())

  if (fields.newPassword !== undefined) {
    data.append('newPassword', fields.newPassword)
    data.append('newPasswordConfirm', fields.newPasswordConfirm ?? '')
  }

  // sent as a pair or not at all, so the server can refuse half of one
  if (fields.securityQuestion?.trim() || fields.securityAnswer?.trim()) {
    data.append('securityQuestion', fields.securityQuestion ?? '')
    data.append('securityAnswer', fields.securityAnswer ?? '')
  }

  if (fields.avatarId !== undefined) data.append('avatarId', fields.avatarId)
  if (fields.role !== undefined) data.append('role', fields.role)

  return data
}

/** Whether anything on the form differs from the account behind it. A new
 *  password or security question counts by existing at all; the name and the
 *  role count only when they have moved. */
const isFormDirty = (
  user: { isAdmin: boolean },
  originalName: string,
  values: { name?: string, newPassword?: string, role?: string, securityQuestion?: string, securityAnswer?: string },
): boolean => (values.name ?? '').trim() !== originalName
  || !!values.newPassword
  || !!values.securityQuestion
  || !!values.securityAnswer
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

/** The question asked on the sign-in screen when the password is forgotten.
 *  An existing account's answer is never sent back, so both read as optional
 *  there: filling them in replaces whatever was set before. Picking a question
 *  clears the answer, since an answer typed for another question is wrong. */
const SecurityFields = ({ isExisting, show, onChange, questionRef, answerRef }: {
  isExisting: boolean
  show: boolean
  onChange: () => void
  questionRef: React.RefObject<HTMLSelectElement | null>
  answerRef: React.RefObject<HTMLInputElement | null>
}) => {
  if (!show) return null

  return (
    <>
      <select
        defaultValue=''
        onChange={() => {
          if (answerRef.current) {
            answerRef.current.value = ''
            answerRef.current.setCustomValidity('')
          }
          onChange()
        }}
        ref={questionRef}
      >
        <option value='' disabled>
          {isExisting ? 'change security question (optional)...' : 'security question, for a forgotten password...'}
        </option>
        {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
      </select>
      <input
        type='text'
        autoComplete='off'
        onChange={(e) => {
          e.target.setCustomValidity('')
          onChange()
        }}
        placeholder={isExisting ? 'new security answer' : 'security answer'}
        ref={answerRef}
      />
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
  const newPassword = useRef<HTMLInputElement>(null)
  const newPasswordConfirm = useRef<HTMLInputElement>(null)
  const name = useRef<HTMLInputElement>(null)
  const role = useRef<HTMLSelectElement>(null)
  const securityQuestion = useRef<HTMLSelectElement>(null)
  const securityAnswer = useRef<HTMLInputElement>(null)
  const [prevDateUpdated, setPrevDateUpdated] = useState(user?.dateUpdated)
  const [state, setState] = useState({
    isDirty: false,
    isChangingPassword: !user || user.userId === null,
    avatarId: undefined as string | undefined,
  })

  const prevIsDirty = useRef(state.isDirty)

  // An account that already exists is being *changed*, so every field reads as
  // optional; a new one is being filled in. The only difference between the two
  // sets of placeholders.
  const isExisting = !!user && user.userId !== null

  // One name per account. It is the username, which is also what the room
  // sees; a guest has no username to sign in with, so theirs is just the name.
  const originalName = (showUsername ? user?.username : user?.name) ?? ''

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
      isDirty: isFormDirty(user, originalName, {
        name: name.current?.value,
        newPassword: newPassword.current?.value,
        role: role.current?.value,
        securityQuestion: securityQuestion.current?.value,
        securityAnswer: securityAnswer.current?.value,
      }),
      isChangingPassword: !!newPassword.current?.value,
    }))
  }

  const handleAvatarChange = (avatarId: string) => {
    setState(prev => ({
      ...prev,
      avatarId,
      isDirty: true,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // a question with no answer could never be passed
    const answer = securityAnswer.current
    if (securityQuestion.current?.value && answer && !answer.value.trim()) {
      answer.setCustomValidity('Enter an answer for your security question')
      answer.reportValidity()
      return
    }

    // unchanged is left out: resending your own name would be refused as taken
    const nextName = name.current?.value.trim()
    const changedName = nextName && nextName !== originalName ? nextName : undefined

    onSubmit(buildFormData({
      [showUsername ? 'username' : 'name']: changedName,
      newPassword: state.isChangingPassword ? newPassword.current?.value ?? '' : undefined,
      newPasswordConfirm: state.isChangingPassword ? newPasswordConfirm.current?.value ?? '' : undefined,
      avatarId: state.avatarId,
      role: role.current?.value,
      securityQuestion: securityQuestion.current?.value,
      securityAnswer: securityAnswer.current?.value,
    }))
  }

  return (
    <form
      className={styles.container}
      key={user?.dateUpdated}
      noValidate
      onSubmit={handleSubmit}
    >
      <InputAvatar
        avatarId={state.avatarId ?? user?.avatarId}
        onSelect={handleAvatarChange}
      />

      <input
        type='text'
        autoComplete={showUsername ? 'username' : 'off'}
        autoFocus={autoFocus}
        defaultValue={originalName}
        onChange={updateDirty}
        placeholder='name'
        // https://github.com/facebook/react/issues/23301
        ref={(r) => {
          name.current = r
          if (autoFocus) r?.setAttribute('autofocus', 'true')
          onFirstFieldRef?.(r)
        }}
      />

      <PasswordFields
        isExisting={isExisting}
        isChangingPassword={state.isChangingPassword}
        show={showPassword}
        onChange={updateDirty}
        newPasswordRef={newPassword}
        confirmRef={newPasswordConfirm}
      />

      <SecurityFields
        isExisting={isExisting}
        show={showPassword}
        onChange={updateDirty}
        questionRef={securityQuestion}
        answerRef={securityAnswer}
      />

      {showRole && <RoleSelect user={user} onChange={updateDirty} selectRef={role} />}

      {children}
    </form>
  )
}

export default AccountForm
