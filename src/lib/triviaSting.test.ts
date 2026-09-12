// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import createTriviaSting from './triviaSting'

/**
 * The mark is drawn, never asserted — so the only thing that can be checked
 * here is that it draws at all, and draws the right shape of thing.
 *
 * That is worth more than it sounds. happy-dom has no canvas 2D, so this file
 * had no test of any kind, and it is 400 lines of arithmetic whose only failure
 * mode is a mark that comes out wrong on a television nobody is watching
 * closely. A recording stub catches the failures that actually happen when this
 * file is edited: a throw, a silent no-op, or a whole element that stops being
 * drawn.
 */

/** Every 2D call the sting makes, recorded rather than rasterised. */
const recordingContext = () => {
  const calls: string[] = []
  const rects: Array<[number, number, number, number]> = []

  return {
    calls,
    rects,
    ctx: new Proxy({} as CanvasRenderingContext2D, {
      get: (_, prop: string) => {
        if (prop === 'measureText') return (text: string) => ({ width: text.length * 4 })
        if (prop === 'canvas') return undefined

        return (...args: unknown[]) => {
          calls.push(prop)
          if (prop === 'fillRect') rects.push(args as [number, number, number, number])
        }
      },
      set: () => true,
    }),
  }
}

const canvasWith = (ctx: CanvasRenderingContext2D) => {
  const cv = document.createElement('canvas')

  cv.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  cv.getBoundingClientRect = (() => ({ width: 400, height: 300 })) as HTMLElement['getBoundingClientRect']

  return cv
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the trivia sting', () => {
  it('draws the registers, the plate and the word on a resting still', () => {
    const rec = recordingContext()
    const sting = createTriviaSting(canvasWith(rec.ctx), { mode: 'still' })

    sting.hold()

    // four registers of fourteen segments is a lot of rectangles; the exact
    // count is not the point, that a mark's worth of them happened is
    expect(rec.rects.length).toBeGreaterThan(50)
    // the word only lands once the plate has wiped fully open, which a still is
    expect(rec.calls).toContain('fillText')

    sting.destroy()
  })

  it('draws the registers alone as a glyph — no plate, no word', () => {
    const rec = recordingContext()
    const sting = createTriviaSting(canvasWith(rec.ctx), { glyph: true })

    sting.hold()

    expect(rec.rects.length).toBeGreaterThan(10)
    expect(rec.calls).toContain('clearRect')
    expect(rec.calls).not.toContain('fillText')

    sting.destroy()
  })

  it('draws a different mark early in the sting than at rest', () => {
    const early = recordingContext()
    const rest = recordingContext()

    const a = createTriviaSting(canvasWith(early.ctx), {})
    a.seek(0)
    a.destroy()

    const b = createTriviaSting(canvasWith(rest.ctx), { mode: 'still' })
    b.hold()
    b.destroy()

    // the bars are down and the plate has not wiped at the opening frame, so
    // the two cannot issue the same rectangles
    expect(early.rects).not.toEqual(rest.rects)
  })

  it('survives a canvas that hands back no context', () => {
    const cv = document.createElement('canvas')
    cv.getContext = (() => null) as HTMLCanvasElement['getContext']

    expect(() => createTriviaSting(cv, {}).play()).not.toThrow()
  })
})
