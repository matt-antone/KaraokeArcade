import React from 'react'
import VuMeter from 'components/VuMeter/VuMeter'
import styles from './Spinner.css'

/**
 * The only loading indicator: the arcade "91 Loading" readout, the word in
 * yellow Silkscreen over a 12-cell strip. The design draws the strip still,
 * 7 of 12 lit, all amber (no peak): a register part-filled, not a spinner.
 * No rings, no skeletons, no motion.
 */
const LIT = 7 / 12

const Spinner = () => (
  <div className={styles.container} role='status'>
    <span className={styles.label}>Loading</span>
    <VuMeter
      className={styles.meter}
      value={LIT}
      segments={12}
      height={14}
      gap={3}
    />
  </div>
)

export default Spinner
