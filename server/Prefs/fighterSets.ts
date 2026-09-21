import fs from 'fs'
import path from 'path'

/**
 * How each of a fighter's four sets is cut and played, off their manifest.json.
 *
 * A fighter folder is something an admin drops onto the box, so the manifest
 * is untrusted input rather than part of the build: it is read field by field
 * and anything that is not a positive finite number is not used. The numbers
 * reach the browser as a setInterval period and a frame count, where a 0 is a
 * busy loop, a NaN is a sprite that never draws, and a negative column count
 * is a background-position off the sheet.
 */
interface SetSpec {
  frames: number
  fps: number
  columns: number
}

export const BATTLE_SETS = ['sing', 'dance', 'ko', 'victory'] as const

type BattleSet = typeof BATTLE_SETS[number]

/** What a set is until its manifest says otherwise: the grid every sheet was
 *  cut to before the manifests existed, so a fighter that shipped without one
 *  is still drawn the way they always were. */
export const DEFAULT_SET: SetSpec = { frames: 16, fps: 8, columns: 8 }

const positive = (v: unknown, fallback: number) =>
  (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback)

/** One set's numbers, defaulted per field rather than per manifest: a file
 *  that gets `fps` right and `columns` wrong keeps its fps. */
export const setSpec = (raw: unknown): SetSpec => {
  if (!raw || typeof raw !== 'object') return DEFAULT_SET

  const { frames, fps, columns } = raw as Record<string, unknown>

  return {
    frames: Math.floor(positive(frames, DEFAULT_SET.frames)),
    fps: positive(fps, DEFAULT_SET.fps),
    columns: Math.floor(positive(columns, DEFAULT_SET.columns)),
  }
}

/** A fighter's four sets. A missing or unparseable manifest is the defaults,
 *  not an error: the folder has already been accepted on its key art, and a
 *  fighter drawn on the old grid beats a gap where a fighter should be. */
const fighterSets = async (dir: string): Promise<Record<BattleSet, SetSpec>> => {
  const raw = await fs.promises.readFile(path.join(dir, 'manifest.json'), 'utf8')
    .then(text => JSON.parse(text) as { sets?: Record<string, unknown> })
    .catch(() => null)

  return Object.fromEntries(
    BATTLE_SETS.map(set => [set, setSpec(raw?.sets?.[set])]),
  ) as Record<BattleSet, SetSpec>
}

export default fighterSets
