import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BATTLE_LOCKUP,
  BATTLE_SINGERS,
  BATTLE_STAGE_PLATE,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  SHEET_COLS,
  battleSingerCell,
  battleSingerFrameCount,
  battleSingerFrontArt,
  battleSingerKeyArt,
  battleSingerAt,
  battleSingerLoop,
  battleSingerOrDefault,
  battleSingerPortrait,
  isBattleGroupOn,
  spriteCellBackground,
  type BattleSingerLoop,
} from './battleSingers'

/**
 * The roster is a hand-written index of files on disk, which is the one kind
 * of data that goes wrong without anything failing to compile: a wrong frame
 * count draws a blank on one frame of a loop every two seconds, and a sheet
 * cut to a different grid draws every frame slightly off centre. Neither shows
 * up in a type-check and both look like a rendering bug rather than a manifest
 * bug.
 *
 * So every path this module can produce is resolved against assets/battle/ and
 * every sheet is measured, rather than asserted against a second copy of the
 * same list — for every group folder on disk, not only the shipped one.
 */

/** assets/ is served as-is at the URL root, so a path this module returns is
 *  also its path from the repo root. That is the whole reason these are plain
 *  strings and not bundler imports. */
const ASSETS = join(__dirname, '..', '..')
const onDisk = (url: string) => existsSync(join(ASSETS, url))

/** Width and height out of a PNG's IHDR, which is always the first chunk and
 *  always at the same offset. Cheaper than a decoder and this only ever needs
 *  the two numbers. */
const pngSize = (url: string) => {
  const head = readFileSync(join(ASSETS, url)).subarray(16, 24)

  return { width: head.readUInt32BE(0), height: head.readUInt32BE(4) }
}

/** Every fighter in every group folder, as the chooser would build them. */
const FIGHTERS = join(ASSETS, 'assets', 'battle', 'fighters')
const dirs = (dir: string) => readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
const ALL = dirs(FIGHTERS).flatMap(group => dirs(join(FIGHTERS, group)).map(slug => battleSingerAt(group, slug)))

const loopsOf = (singer: typeof BATTLE_SINGERS[number]) =>
  Object.keys(singer.loops) as BattleSingerLoop[]

describe('battle roster', () => {
  it('draws a sheet for every loop it claims', () => {
    const missing = ALL
      .flatMap(s => loopsOf(s).map(loop => battleSingerCell(s, loop, 0).url))
      .filter(url => !onDisk(url))

    expect(missing).toEqual([])
  })

  it('cuts every sheet to the grid the sprite CSS assumes', () => {
    // FRAME_WIDTH/FRAME_HEIGHT are also written into the aspect-ratio in
    // BattleSprite.css and PlayerBattle.css. A sheet delivered on a different
    // grid would draw every frame off-centre rather than fail, so the art is
    // measured here instead of being taken on trust.
    const wrong: string[] = []

    for (const singer of ALL) {
      for (const loop of loopsOf(singer)) {
        const cell = battleSingerCell(singer, loop, 0)
        const { width, height } = pngSize(cell.url)
        const rows = Math.ceil(battleSingerFrameCount(singer, loop) / SHEET_COLS)

        if (width !== SHEET_COLS * FRAME_WIDTH || height !== rows * FRAME_HEIGHT) {
          wrong.push(`${cell.url} is ${width}×${height}, expected ${SHEET_COLS * FRAME_WIDTH}×${rows * FRAME_HEIGHT}`)
        }
      }
    }

    expect(wrong).toEqual([])
  })

  it('walks a loop across the sheet and wraps rather than running off the end', () => {
    const belter = BATTLE_SINGERS.find(s => s.id === 'p1')!

    // every set is sixteen, so frame 8 is the start of the second row
    expect(battleSingerCell(belter, 'dance', 8)).toMatchObject({ col: 0, row: 1 })
    expect(battleSingerCell(belter, 'dance', 15)).toMatchObject({ col: 7, row: 1 })
    expect(battleSingerCell(belter, 'dance', 16)).toMatchObject({ col: 0, row: 0 })

    // a tick can arrive negative when two clocks disagree by a frame; the
    // sprite has to keep drawing rather than ask for column -1
    expect(battleSingerCell(belter, 'sing', -1)).toMatchObject({ col: 7, row: 1 })
  })

  it('puts the last cell of an axis flush against its far edge', () => {
    const belter = BATTLE_SINGERS.find(s => s.id === 'p1')!

    // The percentages are what actually position the art: the first cell sits
    // at 0% and the last at 100%, and a single-cell axis has to be 0% rather
    // than a division by zero.
    expect(spriteCellBackground(battleSingerCell(belter, 'dance', 0)).backgroundPosition).toBe('0% 0%')
    expect(spriteCellBackground(battleSingerCell(belter, 'dance', 15)).backgroundPosition).toBe('100% 100%')
    expect(spriteCellBackground(battleSingerCell(belter, 'sing', 7)).backgroundPosition).toBe('100% 0%')
    expect(spriteCellBackground(battleSingerCell(belter, 'sing', 15)).backgroundPosition).toBe('100% 100%')
    expect(spriteCellBackground(battleSingerKeyArt(belter)!).backgroundPosition).toBe('0% 0%')
  })

  it('sizes the sheet in whole multiples of one frame', () => {
    const belter = BATTLE_SINGERS.find(s => s.id === 'p1')!

    expect(spriteCellBackground(battleSingerCell(belter, 'dance', 0)).backgroundSize).toBe('800% 200%')
    expect(spriteCellBackground(battleSingerCell(belter, 'sing', 0)).backgroundSize).toBe('800% 200%')
    expect(spriteCellBackground(battleSingerKeyArt(belter)!).backgroundSize).toBe('100% 100%')
  })

  it('has a portrait for everyone who can be picked', () => {
    const missing = ALL
      .map(s => battleSingerPortrait(s))
      .filter(url => !onDisk(url))

    expect(missing).toEqual([])
  })

  it('has key and front art for everyone who can be picked', () => {
    for (const singer of ALL) {
      for (const { url } of [battleSingerKeyArt(singer), battleSingerFrontArt(singer)]) {
        expect(onDisk(url)).toBe(true)
        expect(pngSize(url)).toEqual({ width: FRAME_WIDTH, height: FRAME_HEIGHT })
      }
    }
  })

  it('serves the stage plate and the lockup', () => {
    expect(onDisk(BATTLE_STAGE_PLATE)).toBe(true)
    expect(onDisk(BATTLE_LOCKUP)).toBe(true)
  })

  it('never leaves a side with nobody standing on it', () => {
    // The sticky selection, the TV's two sides and every card that draws a
    // fighter all lean on this: a battle recorded before the roster shipped
    // has an empty id, and an empty stage is worse than a default one.
    expect(battleSingerOrDefault('').id).toBe('p1')
    expect(battleSingerOrDefault(null).id).toBe('p1')
    expect(battleSingerOrDefault('nobody').id).toBe('p1')
    expect(battleSingerOrDefault('p9').id).toBe('p1')
    expect(battleSingerOrDefault('p3').slug).toBe('hype-man')
  })

  it('draws a group fighter from its id alone, and refuses one that is not a folder name', () => {
    expect(battleSingerOrDefault('halloween/frank')).toMatchObject({ id: 'halloween/frank', group: 'halloween', slug: 'frank', name: 'FRANK' })
    // the shipped group answers to its legacy ids, however it is asked for
    expect(battleSingerAt('default', 'belter').id).toBe('p1')
    expect(battleSingerOrDefault('default/belter').id).toBe('p1')
    // ids go into url(): anything that is not a plain folder name is the default
    for (const bad of ['a/b\')', '../x/y', 'a/b/c', 'a/', '/b', 'x/y"']) {
      expect(battleSingerOrDefault(bad).id).toBe('p1')
    }
  })

  it('shows default until a room turns it off, and other groups once one turns them on', () => {
    expect(isBattleGroupOn(undefined, 'default')).toBe(true)
    expect(isBattleGroupOn({ default: false }, 'default')).toBe(false)
    expect(isBattleGroupOn(undefined, 'halloween')).toBe(false)
    expect(isBattleGroupOn({ halloween: true }, 'halloween')).toBe(true)
  })

  it('gives every drawn fighter both loops', () => {
    // The whole point of wave 2: the six slots that used to be locked now sing
    // and dance like the first two, so nothing falls back any more.
    for (const singer of ALL) {
      expect(battleSingerLoop(singer, 'sing')).toBe('sing')
      expect(battleSingerLoop(singer, 'dance')).toBe('dance')
    }

    expect(BATTLE_SINGERS).toHaveLength(8)
  })

  it('keeps a roster id for every slug and never reuses either', () => {
    // The id is what goes onto an invite and a queue row, so it is the half
    // that cannot be renamed when art is redrawn; the slug is just a folder.
    const ids = BATTLE_SINGERS.map(s => s.id)
    const slugs = BATTLE_SINGERS.map(s => s.slug)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs.every(Boolean)).toBe(true)
  })
})
