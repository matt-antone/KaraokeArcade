import React, { useEffect, useState } from 'react'
import VuMeter from 'components/VuMeter/VuMeter'
import styles from './Spinner.css'

/**
 * The only loading indicator: a VU meter drifting at low level. Deliberately
 * close to the real meter, because on this panel "working" and "level" look
 * alike. It never reaches peak and never lights red — it is idle signal, not
 * activity. No spinner rings, no skeletons. The arcade "91 Loading" screen
 * sets the word itself in yellow Silkscreen over a 12-cell strip.
 */
const LOW = 0.12
const HIGH = 0.62
const STEP = 0.08
const TICK = 110

const Spinner = () => {
  const [value, setValue] = useState(LOW)

  useEffect(() => {
    // A meter that drifts forever is exactly the kind of motion people set this
    // preference to stop; hold it at a steady low reading instead.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let dir = 1
    const id = setInterval(() => {
      setValue((prev) => {
        const next = prev + dir * STEP
        if (next > HIGH || next < LOW) dir *= -1
        return Math.max(LOW, Math.min(HIGH, next))
      })
    }, TICK)

    return () => clearInterval(id)
  }, [])

  return (
    <div className={styles.container} role='status'>
      <span className={styles.label}>Loading</span>
      <VuMeter
        className={styles.meter}
        value={value}
        segments={12}
        peakFrom={2}
        height={14}
      />
    </div>
  )
}

export default Spinner
