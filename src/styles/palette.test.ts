import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The ARCADE palette is closed and text lands on a small, known set of
 * surfaces: the night-violet ground, the panel surface, the violet key, and the
 * three lit fills (amber, yellow, gold). This asserts each pairing the product
 * actually draws clears WCAG AA.
 *
 * Reading the real variables.css rather than a copy of the values is the
 * point — edit a colour and this fails. Semantic names (--ink, --vu, ...) are
 * var() aliases onto the palette, so token() follows the chain to the hex.
 */

const AA_NORMAL = 4.5 // < 18.66px bold
const AA_LARGE = 3.0 // >= 18.66px bold, and non-text UI boundaries

const css = readFileSync(join(__dirname, 'variables.css'), 'utf8')

/** The literal hex behind --name, following var(--x) aliases. */
function token (name: string, seen: string[] = []): string {
  if (seen.includes(name)) throw new Error(`--${name} is a var() cycle: ${seen.join(' -> ')}`)
  const m = css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'))
  if (!m) throw new Error(`--${name} is not declared in variables.css`)

  const value = m[1].trim()
  const alias = value.match(/^var\(--([\w-]+)\)$/)
  if (alias) return token(alias[1], [...seen, name])
  if (!/^#[0-9a-fA-F]{3,8}$/.test(value)) throw new Error(`--${name} resolves to ${value}, not a hex`)
  return value
}

function luminance (hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast (fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

/** Hue in degrees. Contrast ratio is blind to hue, so separating the four
 *  answer keys from one another needs its own measure. */
function hue (hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const chroma = max - Math.min(r, g, b)
  if (chroma === 0) return 0

  const deg = max === r
    ? ((g - b) / chroma) % 6
    : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4

  return (deg * 60 + 360) % 360
}

describe('ARCADE palette contrast', () => {
  // [label, foreground token, background token, threshold]
  const pairs: Array<[string, string, string, number]> = [
    // body copy and song titles
    ['body text on the ground', 'ink', 'chassis', AA_NORMAL],
    ['body text on a panel', 'ink', 'faceplate', AA_NORMAL],
    ['body text on a violet key', 'ink', 'key', AA_NORMAL],
    ['secondary text on a panel', 'ink-2', 'faceplate', AA_NORMAL],
    ['secondary text on an outlined key', 'ink-2', 'chassis', AA_NORMAL],
    ['muted meta on a panel', 'ink-3', 'faceplate', AA_NORMAL],
    ['muted meta on a violet key', 'ink-3', 'key', AA_NORMAL],
    ['placeholder in a field well', 'ink-3', 'key-well', AA_NORMAL],
    // amber: the action, and "yours / live"
    ['amber label on the ground', 'vu', 'chassis', AA_NORMAL],
    ['amber label on a panel', 'vu', 'faceplate', AA_NORMAL],
    ['on-amber text on the amber key', 'on-vu', 'vu', AA_NORMAL],
    ['on-amber text on the amber key edge', 'on-vu', 'vu-hi', AA_NORMAL],
    // yellow: panel titles, scores, prompts; gold: the battle key
    ['yellow title on the ground', 'arc-yellow', 'chassis', AA_NORMAL],
    ['yellow title on a panel', 'arc-yellow', 'faceplate', AA_NORMAL],
    ['on-amber text on yellow', 'arc-on-amber', 'arc-yellow', AA_NORMAL],
    ['battle gold on the ground', 'arc-gold', 'chassis', AA_NORMAL],
    ['on-amber text on battle gold', 'arc-on-amber', 'arc-gold', AA_NORMAL],
    ['opponent green on the ground', 'arc-green', 'chassis', AA_NORMAL],
    // mint: queued / standby
    ['mint standby on a panel', 'standby', 'faceplate', AA_NORMAL],
    // magenta: the 1UP and fault labels
    ['magenta label on the ground', 'alert', 'chassis', AA_NORMAL],
    ['magenta label on a panel', 'alert', 'faceplate', AA_NORMAL],
    // The filled magenta key ("Leave room") carries white Silkscreen, per the
    // handoff. White on #ff2e88 is 3.5:1: it clears large-text AA only, so the
    // danger key must stay a short display-size label, never a sentence.
    ['white on the magenta key', 'on-alert', 'alert', AA_LARGE],
    // spent: already sung. Dim, but still a record you can read.
    ['disabled text on the ground', 'ink-4', 'chassis', AA_LARGE],
  ]

  it.each(pairs)('%s (%s on %s) clears %f:1', (_label, fg, bg, min) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(min)
  })

  // Every trivia answer key is filled and carries its answer in --ink, so each
  // stop has to clear AA on its own. They are deliberately matched: an answer
  // that reads brighter than its three peers looks like the answer.
  const answerStops = [1, 2, 3, 4].flatMap(n => [`ans-${n}-hi`, `ans-${n}-lo`])

  it.each(answerStops)('ink across the %s answer key face clears 4.5:1', (stop) => {
    expect(contrast(token('ink'), token(stop))).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('keeps the four answer keys level with one another', () => {
    // tuned to the same contrast against ink, not the same lightness — blue
    // is much darker than green at equal HSL lightness
    const lit = [1, 2, 3, 4].map(n => contrast(token('ink'), token(`ans-${n}-hi`)))
    expect(Math.max(...lit) - Math.min(...lit)).toBeLessThanOrEqual(0.25)
  })

  it('keeps the answer set closed at four', () => {
    // OpenTDB's type=multiple has four answers. Two stops each, eight total.
    const stops = (css.match(/^\s*--ans-\d+-(?:hi|lo):\s*#/gm) ?? []).length
    expect(stops).toBe(8)
  })

  it('keeps the four answers separable from one another by hue', () => {
    // Contrast ratio cannot see hue — two hues at one lightness measure
    // 1.0:1 — so this asks in degrees. Below 60 two keys read as one.
    const hues = [1, 2, 3, 4].map(n => hue(token(`ans-${n}-hi`)))

    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const apart = Math.abs(hues[i] - hues[j])
        expect(Math.min(apart, 360 - apart), `--ans-${i + 1} vs --ans-${j + 1}`)
          .toBeGreaterThanOrEqual(60)
      }
    }
  })

  it('keeps the palette closed', () => {
    // Every literal colour lives in the --arc-* palette. If this fails you
    // are adding a colour: decide that deliberately, then update the number.
    const entries = (css.match(/^\s*--arc-[\w-]+:\s*#/gm) ?? []).length
    expect(entries).toBe(29)
  })

  it('keeps the QR plate colour in step with --ink', () => {
    // A QR code is painted to a canvas, so its plate has to be a real colour
    // rather than var(--ink). These files are the only place a palette value
    // is written outside variables.css; this keeps them honest.
    const consumers = [
      'routes/Player/components/PlayerQR/PlayerQR.tsx',
      'routes/Settings/components/Player/JoinCode/JoinCode.tsx',
    ]
    for (const file of consumers) {
      const src = readFileSync(join(__dirname, '..', file), 'utf8')
      const m = src.match(/^const INK = '(#[0-9a-fA-F]{3,8})'$/m)
      expect(m, `${file} should declare a literal INK constant`).toBeTruthy()
      // a scannable plate either way: light against the dark modules
      expect(contrast(m![1], token('chassis')), file).toBeGreaterThanOrEqual(AA_NORMAL)
      expect(m![1].toLowerCase(), file).toBe(token('ink').toLowerCase())
    }
  })
})
