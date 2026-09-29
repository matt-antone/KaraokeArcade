type SegmentState = 'off' | 'lit' | 'peak'

/** Values arrive from live sources, so clamp rather than trusting the range. */
export const clampValue = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0

/**
 * Which state segment `i` takes: the design's meter(n, lit, hot). The first
 * round(value × segments) cells are lit; a lit cell at or past
 * round(peakFrom × segments) is the peak. Colour is positional, so the strip
 * reads as a calibrated register that fills. No peakFrom, no peak.
 */
export function segmentState (
  i: number,
  segments: number,
  value: number,
  peakFrom?: number,
): SegmentState {
  if (i >= Math.round(clampValue(value) * segments)) return 'off'
  if (peakFrom !== undefined && i >= Math.round(peakFrom * segments)) return 'peak'
  return 'lit'
}
