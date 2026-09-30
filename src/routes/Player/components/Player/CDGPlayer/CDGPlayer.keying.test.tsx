// @vitest-environment happy-dom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CDGPlayer from './CDGPlayer'

// Keyed, the lyrics sit straight on the singer's club stage: the tinted,
// blurred backdrop behind them is the "transparent black" that hid it.
const markup = (isVideoKeyingEnabled: boolean) => renderToStaticMarkup(
  <CDGPlayer
    cdgAlpha={0.5}
    cdgSize={0.8}
    isPlaying={false}
    isVideoKeyingEnabled={isVideoKeyingEnabled}
    mediaId={1}
    mediaKey={1}
    width={1528}
    height={860}
    onAudioElement={vi.fn()}
    onEnd={vi.fn()}
    onError={vi.fn()}
    onLoad={vi.fn()}
    onPlay={vi.fn()}
    onStatus={vi.fn()}
  />,
)

describe('CDGPlayer backdrop', () => {
  it('draws no backdrop behind keyed lyrics', () => {
    expect(markup(true)).not.toContain('backdrop')
  })

  it('keeps the tinted backdrop when keying is off', () => {
    expect(markup(false)).toContain('backdrop')
  })
})

describe('CDGPlayer placement', () => {
  it('centres the lyrics in the whole box it is given, not its top-left corner', () => {
    const html = markup(true)

    expect(html).toMatch(/class="stage"[^>]*style="width:1528px;height:860px"/)
  })
})

describe('CDGPlayer size', () => {
  const canvasWidth = (cdgSize: number) => {
    const html = renderToStaticMarkup(
      <CDGPlayer
        cdgAlpha={0.5}
        cdgSize={cdgSize}
        isPlaying={false}
        mediaId={1}
        mediaKey={1}
        width={1528}
        height={860}
        onAudioElement={vi.fn()}
        onEnd={vi.fn()}
        onError={vi.fn()}
        onLoad={vi.fn()}
        onPlay={vi.fn()}
        onStatus={vi.fn()}
      />,
    )
    return Number(/<canvas[^>]*width="([\d.]+)"/.exec(html)?.[1])
  }

  // 4:3 in a 16:9 box: height caps it, so the lyrics-size setting is
  // magnified 1.5x for CD+G — 65% of the box's height becomes ~98%
  it('magnifies CD+G by half again over the lyrics-size setting', () => {
    const full = (860 - 20) / 216
    expect(canvasWidth(0.65)).toBeCloseTo(300 * full * 0.65 * 1.5, 5)
  })

  it('never grows past the box it plays in', () => {
    expect(canvasWidth(0.9)).toBeCloseTo(300 * (860 - 20) / 216, 5)
  })
})
