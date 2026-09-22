import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BATTLE_LOCKUP,
  BATTLE_SINGERS,
  BATTLE_STAGE_PLATE,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  battleSingerCell,
  battleSingerSet,
  battleSingerFrontArt,
  battleSingerKeyArt,
  battleSingerAt,
  battleSingerLoop,
  battleSingerOrDefault,
  battleSingerPortrait,
  battleSingerStage,
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

/** Every fighter in every group folder, as the chooser would build them: on
 *  their manifest, which is what the server hands the chooser at runtime.
 *
 *  Reading the manifest here rather than restating its numbers is the point of
 *  the exercise. The grid used to be a constant in this module and the sheets
 *  were measured against it; now the sheets are measured against the file that
 *  claims to describe them, so a 24-frame sheet described as sixteen fails
 *  here instead of drawing two thirds of a loop on the stage. */
const FIGHTERS = join(ASSETS, 'assets', 'battle', 'fighters')
const dirs = (dir: string) => readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)

const manifestOf = (group: string, slug: string) =>
  JSON.parse(readFileSync(join(FIGHTERS, group, slug, 'manifest.json'), 'utf8')) as {
    cell: [number, number]
    sets: Record<string, { frames: number, fps: number, columns: number }>
    location?: { file: string, size: [number, number] }
  }

const setsOf = (group: string, slug: string) => manifestOf(group, slug).sets

const ALL = dirs(FIGHTERS)
  .flatMap(group => dirs(join(FIGHTERS, group)).map(slug => battleSingerAt(group, slug, setsOf(group, slug))))

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
        const { frames, columns } = battleSingerSet(singer, loop)
        const { width, height } = pngSize(cell.url)
        const rows = Math.ceil(frames / columns)

        if (width !== columns * FRAME_WIDTH || height !== rows * FRAME_HEIGHT) {
          wrong.push(`${cell.url} is ${width}×${height}, expected ${columns * FRAME_WIDTH}×${rows * FRAME_HEIGHT}`)
        }
      }
    }

    expect(wrong).toEqual([])
  })

  it('walks a loop across the sheet and wraps rather than running off the end', () => {
    const belter = BATTLE_SINGERS.find(s => s.id === 'p1')!

    // sixteen frames on eight columns, so frame 8 is the start of the second row
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

  it('cuts a set that is not two rows of eight on its own grid', () => {
    // The reason the grid stopped being a constant: a dance traced from a
    // two-second step comes back as 24 frames, which is three rows, and the
    // third row does not exist if the count is assumed.
    const long = battleSingerAt('default', 'belter', { dance: { frames: 24, fps: 12, columns: 8 } })

    expect(battleSingerCell(long, 'dance', 0)).toMatchObject({ cols: 8, rows: 3, col: 0, row: 0 })
    expect(battleSingerCell(long, 'dance', 16)).toMatchObject({ col: 0, row: 2 })
    expect(battleSingerCell(long, 'dance', 23)).toMatchObject({ col: 7, row: 2 })
    // and it wraps at its own count, not at sixteen
    expect(battleSingerCell(long, 'dance', 24)).toMatchObject({ col: 0, row: 0 })
    expect(spriteCellBackground(battleSingerCell(long, 'dance', 0)).backgroundSize).toBe('800% 300%')
  })

  it('reads a rate per set per fighter, and a sane one', () => {
    // fps reaches the browser as a setInterval period, so a zero or a NaN in a
    // manifest is a busy loop or a dead sprite rather than a wrong-looking
    // dance. The cell has to agree with the CSS aspect-ratio too.
    for (const singer of ALL) {
      const { cell, sets } = manifestOf(singer.group, singer.slug)

      expect(cell).toEqual([FRAME_WIDTH, FRAME_HEIGHT])

      for (const loop of loopsOf(singer)) {
        const { frames, fps, columns } = battleSingerSet(singer, loop)

        expect(sets[loop]).toBeDefined()
        expect(frames).toBeGreaterThan(0)
        expect(columns).toBeGreaterThan(0)
        expect(fps).toBeGreaterThan(0)
        expect(Number.isFinite(1000 / fps)).toBe(true)
      }
    }
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

  /**
   * A fighter may ship its own stage, declared in its manifest as
   * `"location": { "file": "location.png", "size": [2048, 1152] }`.
   *
   * Nothing reads that key at runtime — the client resolves the path by
   * convention and falls back to the dive bar on a 404 — so these three cases
   * are what holds the art to the declaration. Every way of getting it wrong
   * draws *something* rather than throwing, which is exactly why none of them
   * would otherwise be noticed until a room saw the wrong room.
   */
  describe('a fighter\'s own stage', () => {
    const declared = ALL
      .map(s => ({ singer: s, location: manifestOf(s.group, s.slug).location }))
      .filter((d): d is { singer: typeof d.singer, location: NonNullable<typeof d.location> } => !!d.location)

    it('names the one file name the client resolves by convention', () => {
      // any other name is a fighter that silently shows the dive bar
      const wrong = declared
        .filter(d => d.location.file !== 'location.png')
        .map(d => `${d.singer.id} declares ${d.location.file}`)

      expect(wrong).toEqual([])
    })

    it('ships the PNG it declares, at the size it declares', () => {
      const wrong: string[] = []

      for (const { singer, location } of declared) {
        const url = battleSingerStage(singer)

        if (!onDisk(url)) {
          wrong.push(`${url} is declared and missing`)
          continue
        }

        const { width, height } = pngSize(url)
        const [w, h] = location.size

        if (width !== w || height !== h) {
          wrong.push(`${url} is ${width}×${height}, declared ${w}×${h}`)
        }
      }

      expect(wrong).toEqual([])
    })

    it('is never narrower than the stage it has to fill', () => {
      // The plate is drawn `height: 100%; width: auto` inside an overflow box,
      // so anything wider than 12:7 is cropped evenly and anything narrower
      // leaves bare gutters down both sides of the room.
      const narrow = declared
        .filter(({ location: { size: [w, h] } }) => w / h < 12 / 7)
        .map(d => `${d.singer.id} is ${d.location.size.join('×')}, narrower than 12:7`)

      expect(narrow).toEqual([])
    })
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
