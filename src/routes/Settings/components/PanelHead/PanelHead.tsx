import React from 'react'
import styles from './PanelHead.css'

/** 09's "All ▾": the panel head's filter, drawn as plain text. The native
 *  select sits invisibly over the words, so a tap still opens the platform's
 *  own picker. */
export const HeadSelect = ({ text, children, ...rest }: { text: string } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <span className={styles.control}>
    {`${text} ▾`}
    <select className={styles.select} {...rest}>{children}</select>
  </span>
)

/** The panel head's other control: the key that shows a panel's admin extras
 *  the design leaves out (Manage / Done). */
export const HeadKey = ({ isOn, onClick }: { isOn: boolean, onClick: () => void }) => (
  <button type='button' className={styles.control} aria-expanded={isOn} onClick={onClick}>
    {isOn ? 'Done' : 'Manage'}
  </button>
)
