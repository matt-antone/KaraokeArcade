import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BATTLE_LOCKUP,
  BATTLE_SINGERS,
  BATTLE_SINGERS_PLAYABLE,
  BATTLE_STAGE_PLATE,
  battleSingerFrame,
  battleSingerFrontArt,
  battleSingerKeyArt,
  battleSingerLoop,
  battleSingerOrDefault,
  battleSingerPortrait,
} from './battleSingers'

/**
 * The roster is a hand-written index of files on disk, which is the one kind
 * of data that goes wrong without anything failing to compile: a wrong frame
 * count draws a 404 on one frame of a loop every two seconds, and a portrait
 * size that was never drawn draws a broken chip on the HUD. Neither shows up
 * in a type-check and both look like a rendering bug rather than a manifest
 * bug.
 *
 * So every path this module can produce is resolved against assets/battle/
 * rather than asserted against a second copy of the same list. Art landing for
 * a pending fighter is then a one-line edit here with a test that proves it
 * really landed.
 */

/** assets/ is served as-is at the URL root, so a path this module returns is
 *  also its path from the repo root. That is the whole reason these are plain
 *  strings and not bundler imports. */
const ASSETS = join(__dirname, '..', '..')
const onDisk = (url: string) => existsSync(join(ASSETS, url))

describe('battle roster', () => {
  it('draws every frame of every loop it claims', () => {
    const missing: string[] = []

    for (const singer of BATTLE_SINGERS) {
      for (const [loop, count] of Object.entries(singer.loops)) {
        for (let i = 0; i < count; i++) {
          const url = battleSingerFrame(singer, loop as 'idle' | 'sing' | 'dance', i)
          if (!onDisk(url)) missing.push(url)
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('has a portrait at both sizes for everyone, real or fallen back', () => {
    const missing = BATTLE_SINGERS
      .flatMap(s => [battleSingerPortrait(s, 34), battleSingerPortrait(s, 80)])
      // the ninth slot is a placeholder with no art of any kind
      .filter(url => !url.startsWith('assets/battle/p9-'))
      .filter(url => !onDisk(url))

    expect(missing).toEqual([])
  })

  it('falls back to the 34 portrait for the one fighter with no large crop', () => {
    // p2-portrait-80.png was never delivered (see ASSETS.md). Asking for the
    // large crop must not produce a URL nothing serves — the select tile would
    // draw an empty box and nobody would know why.
    const crooner = BATTLE_SINGERS.find(s => s.id === 'p2')!

    expect(crooner.hasLargePortrait).toBe(false)
    expect(battleSingerPortrait(crooner, 80)).toBe('assets/battle/p2-portrait-34.png')
  })

  it('has key and front art for everyone who can be picked, and none for who cannot', () => {
    for (const singer of BATTLE_SINGERS) {
      const key = battleSingerKeyArt(singer)
      const front = battleSingerFrontArt(singer)

      if (singer.pending) {
        expect(key).toBeNull()
        expect(front).toBeNull()
      } else {
        expect(onDisk(key!)).toBe(true)
        expect(onDisk(front!)).toBe(true)
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
    expect(BATTLE_SINGERS_PLAYABLE.length).toBeGreaterThan(0)
    expect(battleSingerOrDefault('').pending).toBeFalsy()
    expect(battleSingerOrDefault(null).pending).toBeFalsy()
    expect(battleSingerOrDefault('nobody').pending).toBeFalsy()
    // a pending id is a real roster entry and still must not be drawn
    expect(battleSingerOrDefault('p3').pending).toBeFalsy()
    expect(battleSingerOrDefault('p1').id).toBe('p1')
  })

  it('wraps a loop rather than running off the end of it', () => {
    const belter = BATTLE_SINGERS.find(s => s.id === 'p1')!

    // eight frames, so tick 8 is frame 1 again and the loop is seamless for a
    // caller handing it a tick that only ever goes up
    expect(battleSingerFrame(belter, 'sing', 0)).toBe('assets/battle/p1-sing-01.png')
    expect(battleSingerFrame(belter, 'sing', 7)).toBe('assets/battle/p1-sing-08.png')
    expect(battleSingerFrame(belter, 'sing', 8)).toBe('assets/battle/p1-sing-01.png')
  })

  it('gives a wave-1 fighter something to do when asked to sing', () => {
    // p3-p8 have an idle loop and nothing else. Asking one of them for the
    // sing set has to land on art that exists rather than on a URL built from
    // a set nobody drew.
    const hypeman = BATTLE_SINGERS.find(s => s.id === 'p3')!

    expect(battleSingerLoop(hypeman, 'sing')).toBe('idle')
    expect(battleSingerLoop(BATTLE_SINGERS.find(s => s.id === 'p1')!, 'sing')).toBe('sing')
  })
})
