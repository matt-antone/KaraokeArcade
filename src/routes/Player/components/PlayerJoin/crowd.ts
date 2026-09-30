import type { RoomSinger } from 'shared/types'
import { battleSingerOrDefault, type RosterSinger } from 'lib/battleSingers'

/** Hard cap on the idle screen's crowd. A product decision, not a layout one:
 *  the room reads as full at forty, and every figure is a full-size PNG. */
export const CROWD_MAX = 40

/** Figures per depth row. Ten rows of four fill the cap. */
const PER_ROW = 4

/** Where each column stands across the crowd area, as a fraction of its width. */
const COLUMNS = [0.1, 0.36, 0.62, 0.88]

/** Who stands in a spot of the crowd. `isHere` goes false when they leave: they
 *  fade out where they stood, and the spot is free for the next one in. */
export interface Seat extends RoomSinger {
  isHere: boolean
}

/** Spot k of the crowd, 0 front-left to 39 back-right; null nobody yet. */
export type Seats = (Seat | null)[]

/**
 * Seat the room: 10 draws the people actually in it, not random picks from
 * the roster (the design's placeholder, overridden).
 *
 * Nobody moves once seated. Whoever is already in keeps their spot, a leaver's
 * spot is kept for them (and taken back if they return) until somebody new
 * needs it, and a newcomer takes the frontmost free spot. Spots fill front row
 * first, so three people read as a crowd at the stage rather than as three
 * figures scattered through the depth.
 *
 * `singers` comes in the order they first came in (Rooms.getSingers), so a TV
 * that reloads seats the room much as it was. Past forty, the rest wait for a
 * spot to free; the join line still counts them (up to its own cap).
 */
export const seatsFor = (prev: Seats, singers: RoomSinger[]): Seats => {
  const byId = new Map(singers.map(s => [s.userId, s]))
  const seated = new Set<number>()

  const next: Seats = Array.from({ length: CROWD_MAX }, (_, k) => {
    const seat = prev[k] ?? null
    if (!seat) return null

    const now = byId.get(seat.userId)
    if (now && !seated.has(now.userId)) {
      seated.add(now.userId)
      // a fighter changed on the Account page shows once their session has it
      return { ...now, isHere: true }
    }

    return seat.isHere ? { ...seat, isHere: false } : seat
  })

  for (const singer of singers) {
    if (seated.has(singer.userId)) continue

    const k = next.findIndex(seat => !seat?.isHere)
    if (k === -1) break

    next[k] = { ...singer, isHere: true }
    seated.add(singer.userId)
  }

  return next
}

export interface CrowdMember {
  /** The spot, 0–39: stable for as long as the screen is up. */
  seat: number
  singer: RosterSinger
  isHere: boolean
  /** 0 is the front row; larger is further back, smaller and darker. */
  row: number
  /** Centre of the figure across the crowd area, 0–100. */
  x: number
}

/**
 * Where spot k stands. Deterministic, lifted from the design: odd rows step
 * right so nobody stands directly behind anyone, and a small fixed jitter
 * keeps the columns from reading as a grid.
 */
const spotOf = (k: number) => {
  const row = Math.floor(k / PER_ROW)
  const jitter = ((k * 37) % 11 - 5) / 100
  const x = (COLUMNS[k % PER_ROW] + (row % 2 ? 0.13 : 0) + jitter) % 1

  return { row, x: Math.round(x * 1000) / 10 }
}

/**
 * The figures to draw, one per occupied spot, each as their own fighter.
 *
 * Somebody who has not picked a fighter yet (the sign-in gate asks, so this is
 * a session from before avatars, or one that skipped) is drawn as the default
 * fighter rather than left out: they are in the room and the join line counts
 * them, so the crowd should too, and battleSingerOrDefault is the same figure
 * the battle stage gives them — one person, one face, wherever they turn up.
 */
export const crowdOf = (seats: Seats): CrowdMember[] =>
  seats.flatMap((seat, k) => seat
    ? [{ seat: k, singer: battleSingerOrDefault(seat.avatarId), isHere: seat.isHere, ...spotOf(k) }]
    : [])

/** 10's join line: "12 singers in" / "1 singer in" / "Waiting for singers".
 *  Capped at forty like the crowd, so the line never counts past the room. */
export const joinCountOf = (joined: number) => {
  const n = Math.min(CROWD_MAX, joined)

  return n ? `${n} ${n === 1 ? 'singer' : 'singers'} in` : 'Waiting for singers'
}
