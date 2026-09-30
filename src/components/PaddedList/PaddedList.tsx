import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { List, type DynamicRowHeight, type RowComponentProps, type ListImperativeAPI } from 'react-window'
import { PAGE_SCROLL } from 'components/App/CoreLayout/useCarryHeader'
import styles from './PaddedList.css'

// react-window stamps this on each rendered row before handing the elements to
// observeRowElements(); it is how a measurement is mapped back to a row index.
const INDEX_ATTR = 'data-react-window-index'

/**
 * A react-window `DynamicRowHeight` cache: rows are measured as they render and
 * remembered, and anything not yet measured falls back to `estimate(index)`.
 *
 * This exists because song titles are never truncated — they wrap, and the row
 * grows past its minimum height — so no row height is knowable ahead of time.
 * When `rowHeight` is a DynamicRowHeight, react-window omits the `height` style
 * from each row so it shrink-wraps its real content instead of being clipped.
 *
 * `cacheKey` clears the cache: when it changes, index -> content has changed
 * (e.g. a new search) and every remembered height is meaningless.
 *
 * `estimate` must be referentially stable (see PaddedList's `rowHeight` prop).
 */
const useMeasuredRowHeights = (
  estimate: (index: number) => number,
  cacheKey?: string | number,
): DynamicRowHeight => {
  const [cache, setCache] = useState(() => ({ key: cacheKey, map: new Map<number, number>() }))
  if (cache.key !== cacheKey) setCache({ key: cacheKey, map: new Map() })

  const setRowHeight = useCallback((index: number, size: number) => {
    setCache((prev) => {
      if (prev.map.get(index) === size) return prev
      const map = new Map(prev.map)
      map.set(index, size)
      return { ...prev, map }
    })
  }, [])

  const [observer] = useState(() => (typeof ResizeObserver === 'undefined'
    ? undefined
    : new ResizeObserver((entries) => {
        for (const entry of entries) {
          const index = entry.target.getAttribute(INDEX_ATTR)
          const size = entry.borderBoxSize[0]?.blockSize
          if (index !== null && size) setRowHeight(parseInt(index, 10), size)
        }
      })))

  useEffect(() => () => observer?.disconnect(), [observer])

  const { map } = cache

  return useMemo(() => ({
    getRowHeight: (index: number) => map.get(index) ?? estimate(index),
    // unused: getRowHeight always returns a number, but react-window sniffs for it
    getAverageRowHeight: () => estimate(0),
    setRowHeight,
    observeRowElements: (elements) => {
      if (!observer) return () => {}
      elements.forEach(el => observer.observe(el))
      return () => elements.forEach(el => observer.unobserve(el))
    },
  }), [estimate, map, observer, setRowHeight])
}

interface PaddedListProps {
  /** invalidates measured heights when index -> content changes (e.g. a search term) */
  cacheKey?: string | number
  numRows: number
  onRowsRendered?: (visibleRows: {
    startIndex: number
    stopIndex: number
  }, allRows: {
      startIndex: number
      stopIndex: number
    }) => void
  onRef?(ref: ListImperativeAPI | null): void
  paddingTop: number
  paddingRight?: number
  paddingBottom: number
  paddingLeft?: number
  rowComponent: React.ComponentType<RowComponentProps>
  /**
   * Estimated height of a row, used until it has been measured.
   * Must be referentially stable (module scope or useCallback), otherwise the
   * measurement cache is rebuilt on every render.
   */
  rowHeight(index: number): number
  rowProps?: Partial<RowComponentProps> & Record<string, unknown>
  width?: number
  height: number
}

const PaddedList = ({
  cacheKey,
  numRows,
  onRowsRendered,
  onRef,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  rowComponent: RowComponent,
  rowHeight,
  rowProps = {},
  width,
  height,
}: PaddedListProps) => {
  const handleListRef = (ref: ListImperativeAPI | null) => {
    if (onRef) onRef(ref)
  }

  const PaddedRowComponent = ({ index, style, ariaAttributes, ...rest }: RowComponentProps) => {
    // top & bottom spacer
    if (index === 0 || index === numRows + 1) {
      return (
        <div
          key={index === 0 ? 'top' : 'bottom'}
          style={{ ...style, height: index === 0 ? paddingTop : paddingBottom }}
        />
      )
    }

    return <RowComponent index={--index} style={{ ...style, paddingRight, paddingLeft }} ariaAttributes={ariaAttributes} {...rest} />
  }

  const estimateRowHeight = useCallback((index: number) => {
    // top & bottom spacer
    if (index === 0) return paddingTop
    if (index === numRows + 1) return paddingBottom

    return rowHeight(index - 1)
  }, [numRows, paddingBottom, paddingTop, rowHeight])

  const dynamicRowHeight = useMeasuredRowHeights(estimateRowHeight, cacheKey)

  return (
    <List
      rowProps={rowProps}
      rowComponent={PaddedRowComponent}
      rowCount={numRows + 2} // top & bottom spacer
      rowHeight={dynamicRowHeight}
      onRowsRendered={onRowsRendered}
      overscanCount={10}
      listRef={handleListRef}
      className={styles.container}
      style={{ width, height }}
      {...PAGE_SCROLL}
    />
  )
}

export default PaddedList
