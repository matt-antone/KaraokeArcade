import React from 'react'
import Button from 'components/Button/Button'
import styles from './SoundGate.css'

/**
 * Undesigned and needed, like 10's Play key (U-23): a song started from
 * another device — Settings' transport, a phone's queue — reaches a TV whose
 * page nobody has tapped, and the browser refuses to make sound. That is not
 * a bad file, so it is not "Media failed"; it is one tap on the TV, after
 * which this page may play for the rest of the night.
 */
const SoundGate = ({ onTap }: { onTap: () => void }) => (
  <div className={styles.container} onClick={onTap}>
    <span className={styles.kicker}>Sound is off</span>
    {/* the whole screen takes the tap; the key is where a host looks for it */}
    <Button variant='primary' cta className={styles.key}>
      Tap to start sound
    </Button>
    <span className={styles.note}>The browser needs one tap on this screen before it will play.</span>
  </div>
)

export default SoundGate
