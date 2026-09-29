import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The ARCADE design system's load-bearing rules, asserted across the whole of
 * src/ rather than screen by screen. Source: KaraokeArcadeRedesign/README.md,
 * "Design Tokens".
 *
 * Square corners, hard pixel edges, hard 3px offset type drops, a closed
 * palette in variables.css, Silkscreen for display and Chakra Petch for body.
 * Blur exists only at the peak of a glow burst, inside @keyframes. Every one of
 * these is cheap to check and expensive to rediscover by eye.
 *
 * Scope note: this proves the SOURCE obeys the rules. It cannot prove the
 * rendered result does — a container can still defeat a correct component.
 */

const SRC = join(__dirname, '..')

/** Files matching a glob, repo-relative. */
function files (glob: string): string[] {
  return execFileSync('grep', ['-rlE', '-e', '', SRC, '--include', glob], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)
    .map(l => l.replace(SRC + '/', ''))
}

/** Ripgrep-style search returning matching "path:line:text" rows. */
function search (pattern: string, glob: string): string[] {
  try {
    // -e is required: a pattern starting with "--" (e.g. --font-display) is
    // otherwise parsed as a flag, grep errors, and the catch below turns that
    // into a silent pass. This test suite exists to catch violations, so a
    // check that cannot fail is worse than no check.
    return execFileSync('grep', ['-rnE', '-e', pattern, SRC, '--include', glob],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      .trim().split('\n').filter(Boolean)
      .map(l => l.replace(SRC + '/', ''))
  } catch (err) {
    // grep exits 1 for "no matches" and 2 for a bad pattern or bad usage.
    // Collapsing both to [] makes a broken check look like a clean pass, which
    // is how the --font-display and lookahead checks were silently passing.
    const { status, stderr } = err as { status?: number, stderr?: Buffer }
    if (status === 1) return []
    throw new Error(`grep failed (${status}) for /${pattern}/: ${stderr?.toString().trim()}`)
  }
}

/** Source with block and line comments blanked, line count preserved. */
function stripComments (text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"])\/\/[^\n]*/g, '$1')
}

/** CSS with every @keyframes block blanked, line count preserved. */
function stripKeyframes (css: string): string {
  let out = css
  for (let at = out.indexOf('@keyframes'); at !== -1; at = out.indexOf('@keyframes', at + 1)) {
    let i = out.indexOf('{', at)
    for (let depth = 0; i < out.length; i++) {
      if (out[i] === '{') depth++
      else if (out[i] === '}' && --depth === 0) break
    }
    out = out.slice(0, at) + out.slice(at, i + 1).replace(/[^\n]/g, ' ') + out.slice(i + 1)
  }
  return out
}

/** A comma list split at the top level, so rgba(0, 0, 0, .3) stays whole. */
function splitTopLevel (value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++
    else if (value[i] === ')') depth--
    else if (value[i] === ',' && depth === 0) {
      parts.push(value.slice(from, i))
      from = i + 1
    }
  }
  return [...parts, value.slice(from)]
}

/** True when one shadow's third length — its blur radius — is not zero. */
function isBlurred (shadow: string): boolean {
  const lengths = shadow
    .replace(/[a-z-]+\((?:[^()]|\([^()]*\))*\)/gi, ' ') // colours and var()s
    .split(/\s+/)
    .filter(t => /^-?[\d.]+[a-z%]*$/i.test(t))
  return lengths.length >= 3 && parseFloat(lengths[2]) !== 0
}

/**
 * The JSX open tag starting at `from` (the index of its "<"), or null if it is
 * never closed. Scanned rather than regex-matched because a prop value can
 * contain a bare ">" — `onClick={() => f()}`, `disabled={n >= MAX}` — which
 * ends the tag early and makes a self-closing Button look like a paired one.
 */
function readOpenTag (text: string, from: number): { body: string, selfClosing: boolean, end: number } | null {
  let depth = 0
  let quote = ''

  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === '\'' || c === '`') quote = c
    else if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) {
      const body = text.slice(from, i)
      return { body, selfClosing: /\/\s*$/.test(body), end: i + 1 }
    }
  }

  return null
}

/** Labels of every <Button>…</Button> in `text` that carries no variant. */
function bareLabelledButtons (text: string): string[] {
  const bare: string[] = []

  for (const match of text.matchAll(/<Button\b/g)) {
    const tag = readOpenTag(text, match.index)
    if (!tag || tag.selfClosing || tag.body.includes('variant')) continue

    const close = text.indexOf('</Button>', tag.end)
    if (close === -1) continue

    // a label is text of its own: strip nested elements and {expressions}
    // so an icon child or a bare ★ doesn't read as one. Braces nest, so
    // the innermost pass repeats until there are none left to take
    let label = text.slice(tag.end, close).replace(/<[^>]*>/g, '')
    for (let prev = ''; prev !== label;) {
      prev = label
      label = label.replace(/\{[^{}]*\}/g, '')
    }

    if (/[A-Za-z]/.test(label)) bare.push(label.trim().slice(0, 40))
  }

  return bare
}

describe('ARCADE rules', () => {
  it('uses no emoji anywhere', () => {
    // "No emoji. Anywhere." The favourite control is a text star and library
    // facets are words on keys.
    //
    // Done in JS rather than grep: grep matches bytes in this locale, so a
    // Unicode range flags fragments of unrelated multibyte characters — it
    // reported every em dash in the codebase, and the legitimate ★.
    // built rather than a literal: the /u flag on a regex literal needs an
    // es6 target, and this file compiles under the project's lower one
    const EMOJI = new RegExp('\\p{Extended_Pictographic}|\\uFE0F', 'u')
    const hits: string[] = []

    for (const file of files('*.tsx')) {
      for (const [i, line] of readFileSync(join(SRC, file), 'utf8').split('\n').entries()) {
        // ★ and ☆ are text stars, explicitly what the design system asks for
        if (EMOJI.test(line.replace(/[★☆]/g, ''))) hits.push(`${file}:${i + 1}:${line.trim()}`)
      }
    }

    expect([...new Set(hits)]).toEqual([])
  })

  it('is square: radius 0 everywhere, the Knob the one circle', () => {
    // "Radius: 0 throughout." A corner is a token (all of which are 0) or 0;
    // --radius-round is the Knob's, and nothing else may take it.
    const OK = /border-radius:\s*(0|none|var\(--(radius-(key|panel|tab)|border-radius)\))\s*;/
    const round = search('border-radius', '*.css')
      .filter(l => !l.startsWith('styles/variables.css'))
      .filter(l => !OK.test(l))
      .filter(l => !(l.startsWith('components/Knob/') && /var\(--radius-round\)/.test(l)))
    expect(round).toEqual([])
  })

  it('draws hard edges: no blurred shadow outside a glow-burst keyframe', () => {
    // "Hard offset text shadows (3px 3px 0) instead of blurs, except during
    // glow bursts." A shadow's third length is its blur; it must be 0. The
    // burst's peak frame lives in @keyframes, so those blocks are skipped —
    // and --glow-burst may not be reached for anywhere else.
    const soft: string[] = []

    for (const file of files('*.css')) {
      if (file === 'styles/variables.css') continue
      const text = stripKeyframes(stripComments(readFileSync(join(SRC, file), 'utf8')))

      for (const m of text.matchAll(/(?:^|[;{\s])(text-shadow|box-shadow|filter)\s*:\s*([^;}]+)/g)) {
        const [, prop, value] = m
        const line = text.slice(0, m.index).split('\n').length
        const shadows = prop === 'filter'
          ? [...value.matchAll(/drop-shadow\(((?:[^()]|\([^()]*\))*)\)/g)].map(d => d[1])
          : splitTopLevel(value)
        if (/var\(--glow-burst\)/.test(value) || shadows.some(isBlurred)) {
          soft.push(`${file}:${line}:${prop}: ${value.trim().replace(/\s+/g, ' ')}`)
        }
      }
    }

    expect(soft).toEqual([])
  })

  it('has no frosted glass', () => {
    // "This brand has no frosted glass... a deck's faceplate is opaque."
    expect(search('backdrop-filter', '*.css')).toEqual([])
  })

  it('has no hover states', () => {
    // "No hover language — this is a touch product; states are press and
    // selected only."
    expect(search(':hover', '*.css')).toEqual([])
  })

  it('carries no old-brand hue, in any form', () => {
    // The token pass missed a literal hsl(209 …) in Panel because it only
    // matched the hsl(var(--hue-blue) …) form. Check both.
    expect(search('--hue-(blue|pink)', '*.css')).toEqual([])
    expect(search('hsla?\\(\\s*(209|270)\\b', '*.css')).toEqual([])
  })

  it('takes every colour from the palette in variables.css', () => {
    // The palette is closed. A raw hex, hsl() or coloured rgb() in a component
    // is a new colour sneaking in without deciding it. Transparent black is
    // the one literal allowed: it is an absence of colour (a tap highlight
    // switched off, a shadow faded to nothing), not a colour.
    const literal = search('#[0-9a-fA-F]{3,8}\\b|hsla?\\(|rgba?\\(', '*.css')
      .filter(l => !l.startsWith('styles/variables.css'))
      // data: URIs carry encoded SVG markup, not palette
      .filter(l => !/url\("data:/.test(l))
      .filter(l => !/^[^:]+:\d+:\s*(\/\*|\*)/.test(l))
      .filter(l => /#[0-9a-fA-F]{3,8}\b|hsla?\(/.test(l) || /rgba?\((?!\s*0\s*,\s*0\s*,\s*0\s*[,)])/.test(l))
    expect(literal).toEqual([])
  })

  it('sets type in Silkscreen and Chakra Petch only; the retired faces stay gone', () => {
    // Michroma (DECK display), Figtree (DECK body) and Rubik Mono One (old
    // trivia) are retired. Nothing in src may name them and fonts.css may
    // not import them.
    const RETIRED = /michroma|figtree|rubik mono/i
    const named: string[] = []

    for (const glob of ['*.css', '*.ts', '*.tsx']) {
      for (const file of files(glob)) {
        if (file.startsWith('styles/') || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue
        const code = stripComments(readFileSync(join(SRC, file), 'utf8'))
        if (RETIRED.test(code)) named.push(file)
      }
    }

    expect(named).toEqual([])

    // and nothing still ships them
    expect(readFileSync(join(SRC, 'styles/fonts.css'), 'utf8')).not.toMatch(/@fontsource\/(michroma|figtree|rubik-mono-one)/)

    // and stylesheets reach a family through a token, never by name
    const literalFamily = search('font-family:', '*.css')
      .filter(l => !/font-family:\s*(var\(--font-[a-z]+\)|inherit)\s*;/.test(l))
      .filter(l => !l.startsWith('styles/'))
    expect(literalFamily).toEqual([])
  })

  it('never dims with opacity outside the disabled state', () => {
    // "Dim by colour, never by opacity: a list row is the only opaque layer
    // over its swipe actions, so any transparency lets them ghost through."
    // Disabled is the single sanctioned use (45%).
    // A line-based grep cannot tell a disabled rule from a live one — the
    // selector is on another line — so walk each file tracking its enclosing
    // block. Keyframes are animation, not a dim of content.
    const dims: string[] = []

    for (const file of new Set(search('opacity:\\s*0?\\.[0-9]', '*.css').map(l => l.split(':')[0]))) {
      const text = readFileSync(join(SRC, file), 'utf8')
      let block = ''
      let inKeyframes = false
      let depth = 0

      for (const [i, line] of text.split('\n').entries()) {
        if (/@keyframes/.test(line)) inKeyframes = true
        if (/\{/.test(line) && !/@keyframes/.test(line)) block = line
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
        if (depth === 0) inKeyframes = false

        const m = line.match(/opacity:\s*(0?\.[0-9]+)/)
        if (!m || inKeyframes) continue
        if (/disabled/.test(block)) continue // the one sanctioned dim, at 45%
        // "numbers are quiet": silkscreen counts ride at 75%
        if (m[1] === '.75' || m[1] === '0.75') continue
        if (/^components\/VuMeter\//.test(file)) continue
        dims.push(`${file}:${i + 1}:${line.trim()}`)
      }
    }

    expect(dims).toEqual([])
  })

  it('gives song titles a minimum height, never a fixed one', () => {
    // "--row-song, --row-queue and --row-artist are MINIMUMS, not fixed
    // heights, and no row may be placed in a fixed-height container."
    // anchored: min-height is the correct form and must not match
    const fixed = search('^\\s*height:\\s*var\\(--row-(song|queue|artist)\\)', '*.css')
    expect(fixed).toEqual([])
  })

  it('does not size a non-list view from the measured viewport', () => {
    // Settings sized its column `height: ui.innerHeight` as a flex column, so
    // every panel shrank to fit one viewport and Panel's overflow:hidden
    // clipped the rest — nothing overflowed, so nothing scrolled, and it broke
    // differently in every browser. CSS knows the viewport without being told.
    // The virtualized lists are the sanctioned exception: react-window owns
    // its scroll box and needs a real pixel height.
    const LIST_VIEWS = /^routes\/(Library|Queue|Player)\//
    const sized = search('(innerHeight|headerHeight|footerHeight|contentWidth)', '*.tsx')
      .filter(row => row.includes('/views/'))
      .filter(row => !LIST_VIEWS.test(row))

    expect(sized).toEqual([])
  })

  it('gives every labelled Button a variant', () => {
    // A Button with no variant renders bare — transparent, no key face, and no
    // colour of its own, so its label inherits whatever ink the surrounding
    // view uses. That is right for the icon keys it was built for (the star,
    // the search clear, the visualizer chevrons) and wrong for anything with
    // words on it: the Me tab's "Queue another song" inherited near-black onto
    // the dark ground and was invisible until you knew to look.
    const unlabelled: string[] = []

    for (const file of files('*.tsx')) {
      if (file.endsWith('.test.tsx')) continue
      for (const label of bareLabelledButtons(readFileSync(join(SRC, file), 'utf8'))) {
        unlabelled.push(`${file}: ${label}`)
      }
    }

    expect(unlabelled).toEqual([])
  })

  it('reads a self-closing Button with an inline arrow prop as self-closing', () => {
    // The scan used to be a regex whose tag body stopped at the first ">",
    // so `onClick={() => …}` or `disabled={n >= MAX}` cut the tag short: the
    // self-closing Button read as a paired one, and the next </Button>
    // anywhere in the file donated it a label it never had.
    const fixture = `
      <Button icon='star' onClick={() => toggle(id)} disabled={n >= MAX} />
      <Button variant='primary' onClick={() => close()}>Done</Button>
      <Button onClick={() => go()}>Queue another song</Button>
    `

    // only the third: bare, and it really does have words on it
    expect(bareLabelledButtons(fixture)).toEqual(['Queue another song'])
  })
})
