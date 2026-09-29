import React, { useEffect, useState } from 'react'
import { useAppDispatch } from 'store/hooks'
import { fetchResetQuestion, resetPassword } from 'store/modules/user'
import Button from 'components/Button/Button'
import styles from '../SignIn/SignIn.css'

interface ResetPasswordProps {
  initialUsername: string
  /** The reset went through: sign in on the new password. */
  onReset: (username: string, newPassword: string) => void
  onBack: (username: string) => void
}

/**
 * Forgot password (02b), on one screen: the name the sign-in form already had,
 * the question that name set, the answer and a new password, then Reset & sign
 * in. The new password is typed once and sent as its own confirm.
 *
 * With no name to go on there is a Next step first, which asks for the name
 * and fetches the question. Refusals are shown by the global error message,
 * like every other thunk.
 */
const ResetPassword = ({ initialUsername, onReset, onBack }: ResetPasswordProps) => {
  const dispatch = useAppDispatch()
  const [username, setUsername] = useState(initialUsername)
  const [question, setQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // a refusal is already shown as the error message; the name stays editable
  const askQuestion = (name: string) => dispatch(fetchResetQuestion(name)).unwrap()
    .then(setQuestion, () => {})

  // a name carried over from sign-in: straight to its question
  useEffect(() => {
    if (initialUsername.trim()) void askQuestion(initialUsername.trim())
    // once, for the name this screen opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (question === null) {
      await askQuestion(username.trim())
      return
    }

    try {
      await dispatch(resetPassword({
        username: username.trim(),
        securityAnswer: answer,
        newPassword,
        newPasswordConfirm: newPassword,
      })).unwrap()

      onReset(username.trim(), newPassword)
    } catch {
      // already shown as the error message
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className={styles.reset}>
      <h2 className={styles.heading}>Reset password</h2>
      <div className={styles.fields}>
        <input
          type='text'
          autoComplete='username'
          placeholder='name'
          value={username}
          readOnly={question !== null}
          onChange={e => setUsername(e.target.value)}
        />

        {question !== null && (
          <>
            <span className={styles.label}>Security question</span>
            <p className={styles.question}>{question}</p>
            <input
              type='text'
              autoComplete='off'
              placeholder='answer'
              value={answer}
              onChange={e => setAnswer(e.target.value)}
            />
            <span className={styles.label}>New password</span>
            <input
              type='password'
              autoComplete='new-password'
              placeholder='new password'
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </>
        )}
      </div>

      <div className={styles.spacer} />

      <div className={styles.keys}>
        <Button type='submit' variant='primary' cta>
          {question === null ? 'Next' : 'Reset & sign in'}
        </Button>
        <Button onClick={() => onBack(username.trim())} variant='default' cta>
          Back
        </Button>
      </div>
    </form>
  )
}

export default ResetPassword
