/**
 * The trivia mark: four VU registers, one per answer colour, level-checking in
 * 4/4 behind a silkscreened nameplate.
 *
 * Every frame is a pure function of elapsed milliseconds. The animation is one
 * movement from the first beat to the last — the bar it keeps at minute three
 * is the bar it counted itself in with — so there is no last frame to rest on:
 * `hold()` draws the resting silhouette instead, and that is what a still and
 * every queue-row glyph get. One drawing routine and one set of numbers, so the
 * card on the TV and the glyph in a row cannot drift apart.
 *
 * Framework-free on purpose, like threadField — it owns a canvas, nothing
 * else. The palette is read off the element so variables.css stays the source
 * of truth.
 */

/** Fraction of a register above which a lit segment takes its -hi stop.
 *  Positional, exactly as segments.ts does it: where a segment sits decides
 *  its colour, not how far the bar has travelled. */
const HOT_FROM = 0.55

/** Every timing below is authored against this. A caller asking for a
 *  different duration stretches the same choreography rather than cutting it. */
const REFERENCE_MS = 2500

/** The resting silhouette, as a fraction of the register — the still mark, and
 *  nothing else. It is not a frame of the animation: the animation is always on
 *  a beat, and no beat is a good logo. Every bar tops out above the nameplate,
 *  so the four heights stay readable. */
const REST = [0.62, 0.94, 0.48, 0.78]

/** Four beats to the bar at 120, for as long as the card is up. The mark holds
 *  the stage for a whole handover, and a meter that either freezes or wanders
 *  reads as a broken screen. */
const BEAT = 60000 / 120
const BAR = BEAT * 4
/** How hard each beat of the bar lands. One is the downbeat, three answers it,
 *  two and four are the backbeat. */
const ACCENT = [1, 0.68, 0.88, 0.72]
/** The register whose beat it is takes the whole hit; the other three feel it. */
const OFFBEAT = 0.45
/** Snap up, then fall — finishing just short of the next beat. The rest between
 *  hits is what makes this read as time rather than as a wobble. At a fifth of
 *  the beat the whole attack still reads as one punch. */
const ATTACK = 110
const FALL = BEAT * 0.92
/** The bed the registers sit on between hits, and the top of the swing. Held
 *  apart from REST because REST is a silhouette and this is a movement — but
 *  the bed still clears the nameplate, which is what REST was protecting. */
const LOW = [0.5, 0.6, 0.44, 0.54]
const HIGH = [0.86, 1, 0.72, 0.94]
/** How long the peak marker hangs at the top of a hit before it slides. */
const PEAK_HOLD = 150

/** The count-in is the first bar — the four registers arriving on the four
 *  beats — so the nameplate wipes on the 1 of the second, and TRIVIA comes in
 *  on sixteenths. Everything on the card is on the same grid or it reads as a
 *  mistake. */
const PLATE = [BAR, BAR + BEAT / 2]
const WORD_FROM = PLATE[1]
const WORD_STEP = BEAT / 4

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from))
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const smoothstep = (t: number) => t * t * (3 - 2 * t)

interface Palette {
  bg: string
  well: string
  ink: string
  off: string
  vu: string
  ans: Array<[string, string]>
}

function palette (cv: HTMLCanvasElement): Palette {
  const s = getComputedStyle(cv)
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback

  return {
    bg: v('--chassis-deep', '#0d0e0f'),
    well: v('--key-well', '#17181a'),
    ink: v('--ink', '#e6e4de'),
    off: v('--ink-5', '#4c5055'),
    vu: v('--vu', '#ff8a1e'),
    ans: [
      [v('--ans-1-lo', '#a12129'), v('--ans-1-hi', '#ba2630')],
      [v('--ans-2-lo', '#195834'), v('--ans-2-hi', '#1f6f42')],
      [v('--ans-3-lo', '#324eac'), v('--ans-3-hi', '#3959c4')],
      [v('--ans-4-lo', '#81308e'), v('--ans-4-hi', '#9638a4')],
    ],
  }
}

/** Michroma tracked .13em, the wordmark's own setting. Drawn a glyph at a time
 *  so the tracking is ours and the reveal can be per-letter. */
const setFace = (ctx: CanvasRenderingContext2D, size: number) => {
  ctx.font = `400 ${size}px Michroma, 'Arial Narrow', sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
}

function trackedWidth (ctx: CanvasRenderingContext2D, text: string, size: number, tracking: number) {
  let w = 0
  for (const ch of text) w += ctx.measureText(ch).width + tracking * size
  return w - tracking * size
}

function drawTracked (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  tracking: number,
  count: number,
) {
  let cx = x
  const chars = Array.from(text)

  for (let i = 0; i < chars.length && i < count; i++) {
    ctx.fillText(chars[i], cx, y)
    cx += ctx.measureText(chars[i]).width + tracking * size
  }
}

/** A segment face: flat, with the bevel's 1px top highlight and bottom shade.
 *  Under 4px tall the bevel is noise, so it is dropped. */
function face (
  ctx: CanvasRenderingContext2D,
  fx: number, fy: number, fw: number, fh: number,
  fill: string,
  isLit: boolean,
) {
  const x = Math.round(fx)
  const y = Math.round(fy)
  const w = Math.max(1, Math.round(fw))
  const h = Math.max(1, Math.round(fh))

  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
  if (h < 4) return

  ctx.fillStyle = isLit ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.55)'
  ctx.fillRect(x, y, w, 1)

  if (isLit) {
    ctx.fillStyle = 'rgba(0,0,0,.4)'
    ctx.fillRect(x, y + h - 1, w, 1)
  }
}

/** How high register `i` stands at authored time `t`. One movement for the
 *  whole animation — the count-in is the first bar of it, not a prologue to it. */
function level (i: number, t: number) {
  const n = Math.floor(t / BEAT)
  const since = t - n * BEAT

  // Both ends of a beat sit on the bed, so the swing changing on the bar line
  // is never a jump — which is what lets the four accents differ at all.
  // smoothstep on the way up rather than an out-ease: an out-ease puts most of
  // the swing in the first frame, which strobes instead of moving. The fall
  // keeps its corner at the peak — that corner is what a hit looks like.
  const attack = since < ATTACK
    ? smoothstep(since / ATTACK)
    : 1 - outCubic(span(since, ATTACK, FALL))

  return lerp(LOW[i], HIGH[i], swing(i, n) * attack) * arrival(i, t)
}

/** How much of the hit on beat `n` belongs to register `i`: all of it on its
 *  own beat, a share of it on the other three. Read left to right, the four
 *  count the bar. */
const swing = (i: number, n: number) => ACCENT[n % 4] * (n % 4 === i ? 1 : OFFBEAT)

/** Each register arrives on its own first hit, so the opening bar counts the
 *  four in using the same movement it keeps afterwards. 1 forever after that. */
const arrival = (i: number, t: number) => clamp01((t - i * BEAT) / ATTACK)

/** The peak-hold marker: rides the hit up, hangs at the top of it, then slides
 *  down and lands back on the bar as the beat runs out. Pure in `t` like
 *  everything else — a hit's peak needs no memory, it is the top of the attack. */
function peakHold (i: number, t: number) {
  const at = arrival(i, t)
  if (at <= 0) return null

  const n = Math.floor(t / BEAT)
  const since = t - n * BEAT
  if (since < ATTACK) return level(i, t)

  const top = lerp(LOW[i], HIGH[i], swing(i, n)) * at
  return lerp(top, LOW[i] * at, outCubic(span(since, ATTACK + PEAK_HOLD, BEAT)))
}

interface TriviaStingOptions {
  /** 'still' draws the resting frame once and never animates — what every
   *  small placement wants. */
  mode?: 'sting' | 'still'
  /** Drops the nameplate and the word: the registers alone, for sizes where
   *  Michroma at .13em would be a smudge. */
  glyph?: boolean
  /** Stretches the same choreography. Defaults to 2500. */
  durationMs?: number
  /** Segments per register. 14 on a stage, 5 in a glyph. */
  segments?: number
  /** A spent round: drawn in --ink-5 instead of the answer colours, because
   *  the deck dims by colour and never by opacity. */
  isDim?: boolean
}

interface TriviaSting {
  play (): void
  replay (): void
  /** Jump to an authored millisecond and hold there. */
  seek (ms: number): void
  /** The resting mark — the silhouette, not a moment in the animation. */
  hold (): void
  stop (): void
  /** Cancels the loop, drops the observer and releases the backing store. */
  destroy (): void
}

export default function createTriviaSting (
  cv: HTMLCanvasElement,
  opts: TriviaStingOptions = {},
): TriviaSting {
  const isGlyph = !!opts.glyph
  const isStill = opts.mode === 'still' || isGlyph
  const ctx = cv.getContext('2d', { alpha: isGlyph })

  if (!ctx) {
    return { play () {}, replay () {}, seek () {}, hold () {}, stop () {}, destroy () {} }
  }

  const P = palette(cv)
  const DPR = Math.min(2, window.devicePixelRatio || 1)
  const SEG = opts.segments ?? (isGlyph ? 5 : 14)
  const DUR = opts.durationMs ?? REFERENCE_MS

  let W = 1
  let H = 1
  let req: number | null = null
  // null is the resting still, not a moment on the timeline
  let t: number | null = isStill ? null : 0
  let startedAt = 0

  /** Where the mark sits and how big each part of it is, for one canvas size.
   *  Everything below draws against this rather than recomputing it. */
  function geometry () {
    const markW = isGlyph ? W : Math.min(W * 0.6, H * 1.16)
    const markH = isGlyph ? H : markW / 1.42
    const cx = W / 2
    const barW = markW / (4 + 3 * 0.26)
    const seam = Math.max(isGlyph ? 1 : 2, Math.round((isGlyph ? 1 : 2.5) * DPR))

    return {
      markW,
      markH,
      cx,
      x0: cx - markW / 2,
      y0: H / 2 - markH / 2,
      barW,
      gapX: barW * 0.26,
      seam,
      segH: (markH - (SEG - 1) * seam) / SEG,
    }
  }

  /** One register's column of segments, lit up to its level. */
  function drawSegments (g: ReturnType<typeof geometry>, i: number, bx: number, raw: number) {
    const lit = Math.floor(raw)
    const partial = raw - lit

    for (let s = 0; s < SEG; s++) {
      const sy = g.y0 + g.markH - (s + 1) * g.segH - s * g.seam
      const isLit = s < lit
      const stop = s / SEG >= HOT_FROM ? 1 : 0
      const on = opts.isDim ? P.off : P.ans[i][stop]

      face(ctx, bx, sy, g.barW, g.segH, isLit ? on : P.well, isLit)

      // The segment the bar is standing in, lit by how far into it the level
      // has actually travelled. Without it the bar can only be at one of SEG
      // heights, so every rise is a ladder of pops rather than a movement.
      if (s === lit && partial > 0.02) {
        ctx.globalAlpha = partial
        face(ctx, bx, sy, g.barW, g.segH, on, true)
        ctx.globalAlpha = 1
      }
    }
  }

  /** The hairline sitting at a register's recent maximum. No marker on the
   *  still: a peak hold is a reading, and a still is not reading anything. */
  function drawPeak (g: ReturnType<typeof geometry>, i: number, bx: number, a: number, isRest: boolean) {
    const pk = isRest || opts.isDim ? null : peakHold(i, a)
    if (pk === null || pk <= 0.02) return

    ctx.fillStyle = P.vu
    ctx.fillRect(
      Math.round(bx),
      Math.round(g.y0 + g.markH - pk * g.markH),
      Math.round(g.barW),
      Math.max(1, Math.round(2 * DPR)),
    )
  }

  /** The four registers, each drawn as segments plus its peak marker. */
  function drawRegisters (g: ReturnType<typeof geometry>, a: number, isRest: boolean) {
    for (let i = 0; i < 4; i++) {
      const bx = g.x0 + i * (g.barW + g.gapX)

      drawSegments(g, i, bx, (isRest ? REST[i] : level(i, a)) * SEG)
      drawPeak(g, i, bx, a, isRest)
    }
  }

  /** The nameplate: a graphite band engraved across the registers, low enough
   *  that all four tops stay above it, with the word wiping on across it. */
  function drawPlate (g: ReturnType<typeof geometry>, a: number, isRest: boolean) {
    const wipe = isRest ? 1 : outCubic(span(a, PLATE[0], PLATE[1]))
    if (wipe <= 0) return

    const plateH = g.markH * 0.26
    const plateCy = g.y0 + g.markH * 0.74
    const plateY = Math.round(plateCy - plateH / 2)
    const plateX = Math.round(g.cx - (g.markW * 1.1) / 2)

    ctx.fillStyle = P.bg
    ctx.fillRect(plateX, plateY, Math.round(g.markW * 1.1 * wipe), Math.round(plateH))
    ctx.fillStyle = 'rgba(74,78,84,.5)'
    ctx.fillRect(plateX, plateY, Math.round(g.markW * 1.1 * wipe), 1)
    ctx.fillRect(plateX, plateY + Math.round(plateH) - 1, Math.round(g.markW * 1.1 * wipe), 1)

    const shown = isRest ? 6 : Math.max(0, Math.min(6, Math.floor((a - WORD_FROM) / WORD_STEP)))
    if (!shown) return

    const size = plateH * 0.42
    setFace(ctx, size)
    ctx.fillStyle = opts.isDim ? P.off : P.ink
    drawTracked(ctx, 'TRIVIA', g.cx - trackedWidth(ctx, 'TRIVIA', size, 0.13) / 2, plateCy, size, 0.13, shown)
  }

  function frame (at: number | null) {
    if (isGlyph) ctx.clearRect(0, 0, W, H)
    else {
      ctx.fillStyle = P.bg
      ctx.fillRect(0, 0, W, H)
    }

    // authored time: a caller's duration stretches the timeline, never trims it
    const isRest = at === null
    const a = (at ?? 0) * (REFERENCE_MS / DUR)
    const g = geometry()

    drawRegisters(g, a, isRest)

    // a glyph is the registers alone: no plate, no word
    if (isGlyph) return

    drawPlate(g, a, isRest)
  }

  function size () {
    const r = cv.getBoundingClientRect()
    W = cv.width = Math.max(1, Math.round(r.width * DPR))
    H = cv.height = Math.max(1, Math.round(r.height * DPR))
    frame(t)
  }

  // No terminal frame: the registers keep the bar for as long as the card is
  // up, so the loop runs until destroy(). rAF is already parked when hidden.
  function loop (now: number) {
    t = now - startedAt
    frame(t)
    req = requestAnimationFrame(loop)
  }

  function stop () {
    if (req !== null) cancelAnimationFrame(req)
    req = null
  }

  const api: TriviaSting = {
    play () {
      // reduced motion gets the resting mark, never a slower sting
      if (isStill || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        api.hold()
        return
      }

      stop()
      startedAt = performance.now() - (t ?? 0)
      req = requestAnimationFrame(loop)
    },
    replay () {
      t = 0
      api.play()
    },
    seek (ms: number) {
      stop()
      t = Math.max(0, ms)
      frame(t)
    },
    hold () {
      stop()
      t = null
      frame(t)
    },
    stop,
    destroy () {
      stop()
      ro.disconnect()
      // drop the backing store rather than sit on a full-frame bitmap all night
      cv.width = cv.height = 1
    },
  }

  const ro = new ResizeObserver(size)
  ro.observe(cv)
  size()

  return api
}
