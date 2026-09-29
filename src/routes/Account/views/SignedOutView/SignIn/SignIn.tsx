import React from 'react'
import StartButton from 'components/StartButton/StartButton'
import styles from './SignIn.css'

interface SignInProps {
  username: string
  password: string
  onUsernameChange: (username: string) => void
  onPasswordChange: (password: string) => void
  onSubmit: (e: React.FormEvent) => void
  onForgotPassword: () => void
}

/** 02 as a returning user: name and password, then the start button pinned
 *  to the bottom with the way out of a forgotten password under it. */
const SignIn = ({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
}: SignInProps) => {
  return (
    <form noValidate onSubmit={onSubmit} className={styles.form}>
      <input
        type='text'
        autoComplete='username'
        placeholder='name'
        value={username}
        onChange={e => onUsernameChange(e.target.value)}
      />
      <input
        type='password'
        autoComplete='current-password'
        placeholder='password'
        value={password}
        onChange={e => onPasswordChange(e.target.value)}
      />
      <div className={styles.spacer} />
      <div className={styles.cta}>
        <StartButton sub='Sign in' />
        <button type='button' className={styles.link} onClick={onForgotPassword}>
          Forgot password?
        </button>
      </div>
    </form>
  )
}

export default SignIn
