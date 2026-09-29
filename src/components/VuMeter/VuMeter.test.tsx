import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import VuMeter from './VuMeter'
import { clampValue, segmentState } from './segments'

/**
 * The meter's one piece of real logic: how many segments light, and what each
 * lit one reads as. Tested as a pure function rather than through the DOM —
 * the colours live in a CSS module, which resolves to nothing under vitest.
 */

/** State of every segment on a 20-segment scale, as a compact string. */
const scale = (value: number, peakFrom?: number, segments = 20) =>
  Array.from({ length: segments }, (_, i) =>
    segmentState(i, segments, value, peakFrom)[0]).join('')

describe('segmentState', () => {
  it('lights segments in proportion to value', () => {
    expect(scale(0.5).replace(/o/g, '')).toHaveLength(10)
    expect(scale(0.25).replace(/o/g, '')).toHaveLength(5)
  })

  it('is fully dark at 0 and fully lit at 1', () => {
    expect(scale(0)).toBe('o'.repeat(20))
    expect(scale(1)).not.toContain('o')
  })

  it('draws the design meter(24, 17, 20): 17 lit, the lit ones from 20 peak', () => {
    const hud = (value: number) => Array.from({ length: 24 }, (_, i) =>
      segmentState(i, 24, value, 20 / 24)[0]).join('')

    expect(hud(17 / 24)).toBe('l'.repeat(17) + 'o'.repeat(7))
    expect(hud(1)).toBe('l'.repeat(20) + 'p'.repeat(4))
  })

  it('peaks only past peakFrom', () => {
    // peakFrom 0.8 => segments 16, 17, 18, 19
    expect(scale(1, 0.8)).toBe('l'.repeat(16) + 'p'.repeat(4))
  })

  it('never peaks without a peakFrom', () => {
    // every non-audio meter leaves it out: a scan at 90% is not a fault
    expect(scale(1)).toBe('l'.repeat(20))
  })

  it('colours by position, not by value: a segment does not change as it fills', () => {
    // segment 17 reads the same whether the meter is 90% lit or fully lit
    expect(segmentState(17, 20, 0.9, 0.8)).toBe(segmentState(17, 20, 1, 0.8))
  })
})

describe('clampValue', () => {
  it('clamps live values instead of overflowing the meter', () => {
    // these arrive from scan pct, play position and audio level
    expect(clampValue(1.4)).toBe(1)
    expect(clampValue(-0.3)).toBe(0)
    expect(clampValue(NaN)).toBe(0)
    expect(clampValue(0.42)).toBe(0.42)
  })

  it('never lights more segments than exist', () => {
    expect(scale(99)).not.toContain('o')
    expect(scale(-99)).toBe('o'.repeat(20))
  })
})

describe('VuMeter', () => {
  it('exposes the clamped reading to assistive tech', () => {
    const html = renderToStaticMarkup(<VuMeter value={0.42} label='Scan progress' />)
    expect(html).toContain('role="meter"')
    expect(html).toContain('aria-valuenow="0.42"')
    expect(html).toContain('aria-label="Scan progress"')

    expect(renderToStaticMarkup(<VuMeter value={3} />)).toContain('aria-valuenow="1"')
  })

  it('renders one element per segment', () => {
    const html = renderToStaticMarkup(<VuMeter value={0.5} segments={24} />)
    expect(html.match(/<i/g)).toHaveLength(24)
  })

  it('takes thickness and gap as px or as any CSS length', () => {
    expect(renderToStaticMarkup(<VuMeter height={8} gap={2} />))
      .toContain('--vu-thickness:8px;--vu-gap:2px')
    expect(renderToStaticMarkup(<VuMeter height='2.22vh' gap='.56vh' />))
      .toContain('--vu-thickness:2.22vh;--vu-gap:.56vh')
  })
})
