import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import fighterSets, { BATTLE_SETS, DEFAULT_SET, setSpec } from './fighterSets.js'

/**
 * A fighter folder arrives by being copied onto the box, so its manifest is
 * the one part of the roster nobody reviewed. These numbers become a
 * setInterval period and a sprite grid in every phone in the room, which is
 * why a bad one has to come back as the default rather than as itself.
 */

const withManifest = (body: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'fighter-'))
  writeFileSync(join(dir, 'manifest.json'), body)

  return dir
}

describe('a fighter set out of a manifest', () => {
  it('takes the numbers a well-formed manifest gives', () => {
    expect(setSpec({ frames: 24, fps: 12, columns: 8 })).toEqual({ frames: 24, fps: 12, columns: 8 })
  })

  it('refuses a rate that would stall or spin the sprite clock', () => {
    // 1000/0 is Infinity and 1000/NaN is NaN: the first is a frame that never
    // advances, the second a setInterval that fires as fast as it can.
    for (const fps of [0, -12, Number.NaN, Number.POSITIVE_INFINITY, '12', null, undefined]) {
      expect(setSpec({ frames: 24, fps, columns: 8 }).fps).toBe(DEFAULT_SET.fps)
    }
  })

  it('refuses a grid that would draw off the edge of the sheet', () => {
    for (const bad of [0, -8, Number.NaN, '8', {}]) {
      expect(setSpec({ frames: bad, fps: 12, columns: bad })).toMatchObject({
        frames: DEFAULT_SET.frames,
        columns: DEFAULT_SET.columns,
      })
    }
  })

  it('keeps the fields that are right when one of them is wrong', () => {
    expect(setSpec({ frames: 24, fps: 0, columns: 8 })).toEqual({ frames: 24, fps: 8, columns: 8 })
  })

  it('rounds a fractional count down to a whole cell', () => {
    // A grid is cells; 23.5 frames is 23 drawn and half a frame of blank.
    expect(setSpec({ frames: 23.5, fps: 12, columns: 8.9 })).toMatchObject({ frames: 23, columns: 8 })
  })

  it('is the default for anything that is not an object', () => {
    for (const bad of [null, undefined, 'sixteen', 16, []]) {
      expect(setSpec(bad)).toEqual(DEFAULT_SET)
    }
  })

  it('gives a fighter all four sets whatever the manifest holds', async () => {
    const dir = withManifest(JSON.stringify({ sets: { dance: { frames: 24, fps: 12, columns: 8 } } }))
    const sets = await fighterSets(dir)

    expect(Object.keys(sets).sort()).toEqual([...BATTLE_SETS].sort())
    expect(sets.dance).toEqual({ frames: 24, fps: 12, columns: 8 })
    // the three the manifest did not mention are still drawable
    expect(sets.ko).toEqual(DEFAULT_SET)
  })

  it('draws a fighter whose manifest is missing or unreadable on the old grid', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'fighter-'))
    const broken = withManifest('{ not json')

    for (const dir of [empty, broken]) {
      expect(await fighterSets(dir)).toEqual({
        sing: DEFAULT_SET,
        dance: DEFAULT_SET,
        ko: DEFAULT_SET,
        victory: DEFAULT_SET,
      })
    }
  })
})
