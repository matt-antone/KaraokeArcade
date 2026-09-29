import React from 'react'
import clsx from 'clsx'
import styles from './Tabs.css'

interface Tab<T extends string = string> {
  id: T
  label: string
  count?: number
}

interface TabsProps<T extends string = string> {
  tabs: Array<Tab<T>>
  active: T
  onChange?: (id: T) => void
  className?: string
}

/**
 * The segmented switch in a header: Artists / Songs in the library, Queue / Me
 * / History in the queue. Consolidates a tab row whose CSS was duplicated in
 * LibraryHeader and QueueHeader.
 */
const Tabs = <T extends string>({ tabs, active, onChange, className }: TabsProps<T>) => (
  <div className={clsx(styles.track, className)} role='tablist'>
    {tabs.map(({ id, label, count }) => (
      <button
        key={id}
        type='button'
        role='tab'
        aria-selected={active === id}
        className={clsx(styles.tab, active === id && styles.active)}
        onClick={() => onChange?.(id)}
      >
        {label}
        {typeof count === 'number' && (
          <>
            {' '}
            <span className={styles.count}>{count}</span>
          </>
        )}
      </button>
    ))}
  </div>
)

export default Tabs
