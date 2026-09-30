import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import clsx from 'clsx'
import { requestPause, requestPlay, requestPlayNext, requestVolume } from 'store/modules/status'
import Button from 'components/Button/Button'
import Knob from 'components/Knob/Knob'
import VuMeter from 'components/VuMeter/VuMeter'
import styles from './PlaybackCtrl.css'

/**
 * The room transport. Its only home is the Player panel on the Settings screen:
 * player controls are admin-only and a singer does not pause the room, not even
 * during their own song. Order never changes — play/pause, skip, volume.
 * Play/pause is the single amber key; skip is graphite with an amber glyph,
 * because skipping someone's song deserves one more moment of thought than
 * pausing. The knob is the input and the meter beside it is the readout; there
 * is no volume number.
 *
 * Display options are not here: they belong to the Player panel itself.
 *
 * With no player in the room it still draws, dimmed and inert, so the host
 * learns where the transport lives before the night rather than during it.
 */
const PlaybackCtrl = ({ isDisabled = false }: { isDisabled?: boolean }) => {
  const status = useAppSelector(state => state.status)

  const dispatch = useAppDispatch()
  const handlePause = () => dispatch(requestPause())
  const handlePlay = () => dispatch(requestPlay())
  const handlePlayNext = () => dispatch(requestPlayNext())
  const handleVolume = (val: number) => {
    if (!isDisabled) dispatch(requestVolume(val))
  }

  return (
    <div className={clsx(styles.container, isDisabled && styles.disabled)} aria-disabled={isDisabled}>
      <Button
        className={clsx(styles.key, styles.transport)}
        variant='primary'
        icon={status.isPlaying ? 'PAUSE' : 'PLAY'}
        onClick={status.isPlaying ? handlePause : handlePlay}
        disabled={isDisabled}
        aria-label={status.isPlaying ? 'Pause' : 'Play'}
      />

      <Button
        className={clsx(styles.key, styles.transport, styles.next)}
        variant='default'
        icon='PLAY_NEXT'
        onClick={handlePlayNext}
        disabled={isDisabled}
        aria-label='Play Next'
      />

      <div className={styles.volume}>
        <Knob value={status.volume} onChange={handleVolume} label='vol' />
        <VuMeter
          value={status.isPlaying ? status.volume * 0.85 : 0}
          segments={14}
          label='Room level'
        />
      </div>
    </div>
  )
}

export default PlaybackCtrl
