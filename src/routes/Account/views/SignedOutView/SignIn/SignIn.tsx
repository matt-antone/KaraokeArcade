import React from 'react'
import Button from 'components/Button/Button'
import styles from './SignIn.css'

interface SignInProps {
  username: string
  password: string
  onUsernameChange: (username: string) => void
  onPasswordChange: (password: string) => void
  onSubmit: (e: React.FormEvent) => void
  onFirstFieldRef: (el: HTMLInputElement | null) => void
  onForgotPassword: () => void
}

const SignIn = ({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onFirstFieldRef,
  onForgotPassword,
}: SignInProps) => {
  return (
    <form noValidate onSubmit={onSubmit} className={styles.container}>
      <input
        type='text'
        autoComplete='username'
        placeholder='name'
        value={username}
        onChange={e => onUsernameChange(e.target.value)}
        ref={onFirstFieldRef}
      />
      <input
        type='password'
        autoComplete='current-password'
        placeholder='password'
        value={password}
        onChange={e => onPasswordChange(e.target.value)}
      />
      <Button type='submit' variant='primary'>
        Sign In
      </Button>
      <Button onClick={onForgotPassword} variant='default'>
        Forgot password?
      </Button>
    </form>
  )
}

export default SignIn
