import React from 'react'
import styles from './StartButton.css'

interface StartButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** What pressing it does, under the blinking label: 'Sign in', 'Create'. */
  sub: string
}

/**
 * The cabinet's "1 Player Start" button (Arcade Flow v2, 02): a round, lit
 * arcade key in a chrome bezel, with the blinking label under it.
 *
 * Modelled hardware rather than a flat key, so it is the one place that is
 * round, soft-shadowed and coloured off the palette; the
 * rules test exempts this folder by name. A submit button by default, since
 * both forms that draw it submit on it.
 */
const StartButton = ({ sub, type = 'submit', ...rest }: StartButtonProps) => (
  <div className={styles.container}>
    <button type={type} aria-label='1 player start' className={styles.button} {...rest}>
      <span className={styles.ring} />
      <span className={styles.well} />
      <span className={styles.cap}>
        <span className={styles.player} aria-hidden='true'>
          <span className={styles.head} />
          <span className={styles.row}>
            <span className={styles.arm} />
            <span className={styles.body} />
            <span className={styles.arm} />
          </span>
          <span className={`${styles.row} ${styles.legs}`}>
            <span className={styles.leg} />
            <span className={styles.leg} />
          </span>
        </span>
      </span>
    </button>
    <div className={styles.labels}>
      <span className={styles.label}>1 Player Start</span>
      <span className={styles.sub}>{sub}</span>
    </div>
  </div>
)

export default StartButton
