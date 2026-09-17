import React, { useState } from 'react'
import { useAppDispatch } from 'store/hooks'
import { fetchResetQuestion, resetPassword } from 'store/modules/user'
import Button from 'components/Button/Button'
import styles from '../SignIn/SignIn.css'

interface ResetPasswordProps {
  initialUsername: string
  onDone: (username: string) => void
  onFirstFieldRef: (el: HTMLInputElement | null) => void
}

/**
 * Forgot password, in two steps on one form: the username fetches the question
 * the singer set, then the answer and a new password go back together.
 * Refusals are shown by the global error message, like every other thunk.
 */
const ResetPassword = ({ initialUsername, onDone, onFirstFieldRef }: ResetPasswordProps) => {
  const dispatch = useAppDispatch()
  const [username, setUsername] = useState(initialUsername)
  const [question, setQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (question === null) {
        setQuestion(await dispatch(fetchResetQuestion(username.trim())).unwrap())
        return
      }

      await dispatch(resetPassword({
        username: username.trim(),
        securityAnswer: answer,
        newPassword,
        newPasswordConfirm,
      })).unwrap()

      onDone(username.trim())
    } catch {
      // already shown as the error message
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className={styles.container}>
      <input
        type='text'
        autoComplete='username'
        placeholder='name'
        value={username}
        readOnly={question !== null}
        onChange={e => setUsername(e.target.value)}
        ref={onFirstFieldRef}
      />

      {question !== null && (
        <>
          <p>{question}</p>
          <input
            type='text'
            autoComplete='off'
            placeholder='answer'
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            autoFocus
          />
          <input
            type='password'
            autoComplete='new-password'
            placeholder='new password'
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
          <input
            type='password'
            autoComplete='new-password'
            placeholder='confirm new password'
            value={newPasswordConfirm}
            onChange={e => setNewPasswordConfirm(e.target.value)}
          />
        </>
      )}

      <Button type='submit' variant='primary'>
        {question === null ? 'Next' : 'Change Password'}
      </Button>
      <Button onClick={() => onDone(username.trim())} variant='default'>
        Back to Sign In
      </Button>
    </form>
  )
}

export default ResetPassword
