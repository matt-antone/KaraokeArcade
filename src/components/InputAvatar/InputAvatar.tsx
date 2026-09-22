import React, { useState } from 'react'
import Modal from 'components/Modal/Modal'
import UserAvatar from 'components/UserAvatar/UserAvatar'
import AvatarPicker from 'components/BattleStage/AvatarPicker'
import styles from './InputAvatar.css'

/**
 * Changing which fighter you are, from the account form.
 *
 * Stands in the slot the photo upload used to have, and is the same grid the
 * sign-in gate shows — the choice is one thing, so there is one screen for
 * making it, whether you are being asked for the first time or changing your
 * mind six weeks later.
 *
 * It reports the choice rather than writing it: the form is already going to
 * submit, and a control that wrote to the account from under an unsaved form
 * would make CANCEL a lie about half the page.
 */
interface InputAvatarProps {
  avatarId: string | null | undefined
  onSelect: (avatarId: string) => void
}

const InputAvatar = ({ avatarId, onSelect }: InputAvatarProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleChoose = (chosen: string) => {
    onSelect(chosen)
    setIsOpen(false)
  }

  return (
    <>
      <button
        type='button'
        className={styles.button}
        aria-label='Change your character'
        onClick={() => setIsOpen(true)}
      >
        <UserAvatar className={styles.avatar} avatarId={avatarId} size={80} />
        <span className={styles.hint}>CHANGE</span>
      </button>

      {isOpen && (
        <Modal
          className={styles.modal}
          title='Your character'
          onClose={() => setIsOpen(false)}
        >
          <AvatarPicker avatarId={avatarId} onChoose={handleChoose} />
        </Modal>
      )}
    </>
  )
}

export default InputAvatar
