import { describe, expect, it } from 'vitest'
import battleVideoRect from './battleVideoRect'

/**
 * The video panel's geometry, which is a copy of numbers that live in
 * PlayerBattle.css and therefore the kind of thing that drifts without
 * anything failing.
 *
 * What drift looks like on the night: the karaoke video creeping out from
 * behind the bezel on one side, or sitting inside it with a black margin. Both
 * read as a broken player rather than as a stylesheet and a module disagreeing
 * about where 67.2 units is.
 */

/** A 16:9 display, which is what the room is nearly always looking at. */
const W = 1920
const H = 1080

describe('the battle video panel', () => {
  it('is 13e\'s panel, doubled to 1080: 764 x 430 at 168, 84 on the design\'s 960', () => {
    expect(battleVideoRect(W, H, 1)).toEqual({ left: 336, top: 168, width: 1528, height: 860 })
    expect(battleVideoRect(W, H, 2)).toEqual({ left: 56, top: 168, width: 1528, height: 860 })
  })

  it('sits inside the stage, on the side the singer is not', () => {
    // 16:9 on a 16:9 display: the stage is the whole screen
    const stageW = Math.min(W, H * (384 / 216))
    const stageLeft = (W - stageW) / 2

    const one = battleVideoRect(W, H, 1)
    const two = battleVideoRect(W, H, 2)

    // side 1 sings from the left, so its video is the right-hand box
    expect(one.left).toBeGreaterThan(two.left)

    // and both stay inside the stage rather than running off into the pillarbox
    expect(two.left).toBeGreaterThanOrEqual(Math.round(stageLeft))
    expect(one.left + one.width).toBeLessThanOrEqual(Math.round(stageLeft + stageW))
  })

  it('mirrors exactly between the two singing beats', () => {
    const one = battleVideoRect(W, H, 1)
    const two = battleVideoRect(W, H, 2)

    // same box, same height, same top — the beats differ in one number only
    expect(one.width).toBe(two.width)
    expect(one.height).toBe(two.height)
    expect(one.top).toBe(two.top)

    // and the gap outside each is the gap inside the other
    const stageW = Math.min(W, H * (384 / 216))
    const stageLeft = (W - stageW) / 2
    const farGap = two.left - stageLeft
    const nearGap = stageLeft + stageW - (one.left + one.width)

    expect(Math.round(farGap)).toBe(Math.round(nearGap))
  })

  it('keeps the panel proportions the stylesheet draws the bezel at', () => {
    const { width, height } = battleVideoRect(W, H, 1)

    // 13e's 305.6 x 172 design units. Rounded to whole pixels, so compare the ratio.
    expect(width / height).toBeCloseTo(305.6 / 172, 2)
  })

  it('scales with the display rather than assuming one', () => {
    const big = battleVideoRect(W, H, 1)
    const small = battleVideoRect(W / 2, H / 2, 1)

    // within a pixel: the rect is rounded to whole pixels at each size, so
    // half of a rounded number is not always the number rounded from half
    expect(Math.abs(small.width - (big.width / 2))).toBeLessThanOrEqual(1)
    expect(Math.abs(small.height - (big.height / 2))).toBeLessThanOrEqual(1)
  })

  it('follows the stage when the display is the narrow one', () => {
    // A window taller than 16:9 makes the stage width-limited and letterboxed
    // instead, and the panel has to come down with it rather than staying
    // pinned to a top edge the stage no longer touches.
    const rect = battleVideoRect(1200, 1200, 1)
    const stageH = 1200 * (216 / 384)

    expect(rect.top).toBeGreaterThan(Math.round((1200 - stageH) / 2) - 1)
    expect(rect.top + rect.height).toBeLessThanOrEqual(Math.round((1200 + stageH) / 2))
  })
})
