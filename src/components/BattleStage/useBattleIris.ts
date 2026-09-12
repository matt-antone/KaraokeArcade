import { useEffect, useRef, useState } from 'react'

/**
 * The transition every Singer Battle phone screen changes under.
 *
 * A step change is not a cut. A circle grows out of the exact point the thumb
 * just left, and the screen behind it is swapped while that circle covers it,
 * so the new screen appears to have come out of the thing that was touched
 * rather than out of nowhere. The origin is also handed to the arriving screen
 * as its `transform-origin`, which is what makes the slam read as the same
 * motion continuing rather than a second, unrelated one.
 *
 * The measurement is relative to the frame rather than the viewport because
 * both are moving targets — a phone with a keyboard up, a screen mid-scroll —
 * and a percentage of the frame is the only form the CSS can use.
 */

/** The palette's four burst tones. Named rather than passed as hex at every
 *  call site, because the colour of a burst says which side is acting and
 *  three call sites with three slightly different reds is how that stops
 *  meaning anything. */
export const BATTLE_TONE = {
  /** the local player, and every primary action */
  gold: '#ffd166',
  /** side one: the challenger */
  one: '#ff8a8a',
  /** side two: the opponent */
  two: '#7fe3a5',
  /** going backwards, which is nobody's colour */
  quiet: '#4a4e54',
}

export interface Iris {
  x: string
  y: string
  tone: string
  /** The burst is drawn only while this is true. */
  isBursting: boolean
  /** Bumped per burst and used as the element's key: two bursts in a row are
   *  the same element with the same animation, and without a remount the
   *  second one never plays. */
  n: number
}

export interface BattleRect {
  left: number
  top: number
  width: number
  height: number
}

/** Mid-iris, where the swap is invisible. */
const COVER_MS = 170
/** Just past the 460ms keyframes, so nothing unmounts mid-animation. */
const BURST_MS = 470

export default function useBattleIris () {
  const frameRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  const [iris, setIris] = useState<Iris>({
    x: '50%',
    y: '50%',
    tone: BATTLE_TONE.gold,
    isBursting: false,
    n: 0,
  })

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  /** An element's box in the frame's own coordinates, which is the only frame
   *  of reference the flyer and the iris can both be expressed in. */
  const rectIn = (el: Element | null | undefined): BattleRect | null => {
    const frame = frameRef.current
    if (!el || !frame) return null

    const box = el.getBoundingClientRect()
    const bounds = frame.getBoundingClientRect()

    return {
      left: box.left - bounds.left,
      top: box.top - bounds.top,
      width: box.width,
      height: box.height,
    }
  }

  /**
   * Fire the burst from whatever was touched, and land `apply` under it.
   *
   * `apply` runs mid-burst rather than on the tap: a step that changes on the
   * tap has already changed by the time the circle is big enough to hide it,
   * and the user sees the swap they were meant to be covered from. Anything
   * that must not be lost to a phone backgrounding itself — a dispatch, in
   * particular — belongs at the call site, before this, not in `apply`.
   */
  const burst = (e: React.MouseEvent<HTMLElement>, tone: string, apply?: () => void) => {
    // read synchronously: currentTarget is null by the time a timer runs
    const at = rectIn(e.currentTarget)
    const frame = frameRef.current?.getBoundingClientRect()

    timers.current.forEach(clearTimeout)
    setIris(was => ({
      x: at && frame ? `${Math.round((at.left + at.width / 2) / frame.width * 100)}%` : was.x,
      y: at && frame ? `${Math.round((at.top + at.height / 2) / frame.height * 100)}%` : was.y,
      tone,
      isBursting: true,
      n: was.n + 1,
    }))

    timers.current = [window.setTimeout(() => setIris(was => ({ ...was, isBursting: false })), BURST_MS)]
    if (apply) timers.current.push(window.setTimeout(apply, COVER_MS))
  }

  return { frameRef, iris, burst, rectIn }
}
