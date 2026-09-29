import React from 'react'
import clsx from 'clsx'
import { clampValue, segmentState } from './segments'
import styles from './VuMeter.css'

interface VuMeterProps {
  /** 0-1. Values outside the range are clamped; NaN reads as 0. */
  value?: number
  /**
   * Segment count. A *visual* choice, not a data one: keep it high (12-32) so
   * the bar reads as a level. Never map segments 1:1 onto a small quantity —
   * a four-segment meter reads as four blocks, not a level.
   */
  segments?: number
  /**
   * Fraction of the scale from which lit segments read yellow instead of
   * amber (the HUD's 20/24, the TV's 28/32). Leave it out for no peak, which
   * is what every non-audio meter wants.
   */
  peakFrom?: number
  /** Every lit cell mint instead of amber/yellow (09 media). */
  tone?: 'amber' | 'mint'
  /** Bar thickness: px as a number, or any CSS length (the TV's vh). */
  height?: number | string
  /** Space between cells: px as a number, or any CSS length. */
  gap?: number | string
  /** Stack bottom-up instead of left-to-right. */
  vertical?: boolean
  /** Describes what is being measured, for assistive tech. */
  label?: string
  className?: string
  style?: React.CSSProperties
}

const length = (v: number | string) => typeof v === 'number' ? `${v}px` : v

const VuMeter = ({
  value = 0,
  segments = 24,
  peakFrom,
  tone = 'amber',
  height = 12,
  gap = 2,
  vertical,
  label,
  className,
  style,
}: VuMeterProps) => {
  const safe = clampValue(value)

  return (
    <div
      className={clsx(styles.container, vertical && styles.vertical, tone === 'mint' && styles.mint, className)}
      role='meter'
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={safe}
      aria-label={label}
      style={{ '--vu-thickness': length(height), '--vu-gap': length(gap), ...style } as React.CSSProperties}
    >
      {Array.from({ length: segments }, (_, i) => {
        const state = segmentState(i, segments, safe, peakFrom)

        return (
          <i
            key={i}
            className={clsx(styles.seg, state !== 'off' && styles.lit, state === 'peak' && styles.peak)}
          />
        )
      })}
    </div>
  )
}

export default VuMeter
