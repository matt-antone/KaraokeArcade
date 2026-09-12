import React, { useState } from 'react'
import { useAppDispatch } from 'store/hooks'
import Accordion from 'components/Accordion/Accordion'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import Slider from 'components/Slider/Slider'
import useConfirm from 'components/Modal/useConfirm'
import { requestScoresReset } from 'store/modules/rooms'
import {
  TRIVIA_COUNTDOWN_DEFAULT,
  TRIVIA_COUNTDOWN_MAX,
  TRIVIA_COUNTDOWN_MIN,
  type IRoomPrefs,
} from 'shared/types'
import styles from './TriviaPrefs.css'

interface TriviaPrefsProps {
  prefs: Partial<IRoomPrefs>
  onChange: (prefs: Partial<IRoomPrefs>) => void
  /** Absent while the room is still being created — there is nothing to
   *  reset the scores of yet. */
  roomId?: number
}

const TriviaPrefs = ({ onChange, prefs = {}, roomId }: TriviaPrefsProps) => {
  const dispatch = useAppDispatch()
  const [isReset, setIsReset] = useState(false)

  const isEnabled = prefs?.trivia?.isEnabled ?? false
  const countdown = prefs?.trivia?.countdownSeconds ?? TRIVIA_COUNTDOWN_DEFAULT

  const handleSetPref = (update: Partial<IRoomPrefs['trivia']>) => {
    onChange({ ...prefs, trivia: { ...prefs.trivia, ...update } })
  }

  const [confirm, confirmDialog] = useConfirm()

  const handleReset = async () => {
    if (typeof roomId !== 'number') return

    // undoable only by playing the whole night again, so it asks first
    if (!await confirm({
      title: 'Reset scores',
      confirmLabel: 'Reset scores',
      message: 'Reset every score in this room?\n\nThe scoreboard starts empty and this cannot be undone.',
    })) return

    dispatch(requestScoresReset(roomId))
    setIsReset(true)
  }

  return (
    <Accordion
      headingComponent={(
        <div className={styles.heading}>
          <Icon icon='DICE' />
          <div>Trivia</div>
        </div>
      )}
    >
      <div className={styles.content}>
        <div>
          <InputCheckbox
            label='Play trivia rounds'
            checked={isEnabled}
            onChange={event => handleSetPref({ isEnabled: event.currentTarget.checked })}
          />
        </div>
        {isEnabled && (
          <>
            <div className={styles.field}>
              <label id='label-trivia-countdown' className={styles.groupLabel}>
                {`Answer time — ${countdown}s`}
              </label>
              <Slider
                className={styles.slider}
                min={TRIVIA_COUNTDOWN_MIN}
                max={TRIVIA_COUNTDOWN_MAX}
                step={5}
                value={countdown}
                onChange={(val: number) => handleSetPref({ countdownSeconds: Math.round(val) })}
                aria-labelledby='label-trivia-countdown'
              />
            </div>
            {typeof roomId === 'number' && (
              <div className={styles.field}>
                <label className={styles.groupLabel}>Scoreboard</label>
                <Button variant='danger' onClick={handleReset}>
                  {isReset ? 'Scores reset' : 'Reset scores'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {confirmDialog}
    </Accordion>
  )
}

export default TriviaPrefs
