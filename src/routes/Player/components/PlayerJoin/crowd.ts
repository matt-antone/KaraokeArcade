import type { RosterSinger } from 'lib/battleSingers'

/** Hard cap on the idle screen's crowd. A product decision, not a layout one:
 *  the room reads as full at forty, and every figure is a full-size PNG. */
export const CROWD_MAX = 40

/** Figures per depth row. Ten rows of four fill the cap. */
const PER_ROW = 4

/** Where each column stands across the crowd area, as a fraction of its width. */
const COLUMNS = [0.1, 0.36, 0.62, 0.88]

export interface CrowdMember {
  singer: RosterSinger
  /** 0 is the front row; larger is further back, smaller and darker. */
  row: number
  /** Centre of the figure across the crowd area, 0–100. */
  x: number
}

/**
 * The crowd on the idle screen, from one random number per figure.
 *
 * The randoms are drawn once by the caller and kept, so a re-render — a tick,
 * the fighter listing landing — never reshuffles the room; only which roster
 * the picks index into can change. Positions are deterministic, lifted from
 * the design: odd rows step right so nobody stands directly behind anyone, and
 * a small fixed jitter keeps the columns from reading as a grid.
 */
export const crowdOf = (seeds: number[], roster: RosterSinger[]): CrowdMember[] => {
  if (!roster.length) return []

  return seeds.slice(0, CROWD_MAX).map((seed, k) => {
    const row = Math.floor(k / PER_ROW)
    const jitter = ((k * 37) % 11 - 5) / 100
    const x = (COLUMNS[k % PER_ROW] + (row % 2 ? 0.13 : 0) + jitter) % 1

    return {
      singer: roster[Math.min(roster.length - 1, Math.floor(seed * roster.length))],
      row,
      x: Math.round(x * 1000) / 10,
    }
  })
}

/** 10's join line: "12 singers in" / "1 singer in" / "Waiting for singers".
 *  Capped at forty like the crowd, so the line never counts past the room. */
export const joinCountOf = (joined: number) => {
  const n = Math.min(CROWD_MAX, joined)

  return n ? `${n} ${n === 1 ? 'singer' : 'singers'} in` : 'Waiting for singers'
}
