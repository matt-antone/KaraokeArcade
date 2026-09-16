import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The DECK design system's load-bearing rules, asserted across the whole of
 * src/ rather than screen by screen.
 *
 * These exist because every one of them was violated at some point during the
 * rebrand in a way no type-check or unit test could see: a circular Slider
 * handle in a system where only knobs and radios are circles, a live
 * hsl(209 …) in Panel after the hue migration "finished", an opacity dim on a
 * row that would let its swipe keys ghost through. The rules are cheap to
 * check and expensive to rediscover.
 *
 * Scope note: this proves the SOURCE obeys the rules. It cannot prove the
 * rendered result does — a container can still defeat a correct component,
 * which is exactly what react-window did to non-truncating titles.
 */

const SRC = join(__dirname, '..')

/**
 * Singer Battle speaks arcade, not DECK, and does so on purpose.
 *
 * A battle is the one thing in this product that is a spectacle rather than a
 * control surface: a fighting-game stage on the TV, and — since the redesign —
 * the same language carried onto the three phone screens around it, so the
 * room is looking at one thing from four places rather than at a deck that
 * happens to mention a fight. That language is hard black type shadows, its
 * own crimson/moss/gold palette, Michroma at display sizes and art dimmed by
 * opacity, every one of which DECK bans for good reasons that do not apply to
 * a screen nobody is operating.
 *
 * The exemption is a path list rather than a per-rule allowance so it stays
 * one decision somebody can reverse in one line, and so the rules below keep
 * their full force everywhere else — which is the whole point of this file.
 * The values these screens are held to instead are in
 * docs/singer-battle/design/, and are just as closed.
 */
const ARCADE = [
  'routes/Player/components/PlayerBattle/',
  'components/BattleStage/',
  'components/BattleSetup/',
  'components/BattleInvite/',
  'components/BattleVote/',
  'components/Header/BattleStrip/',
  'routes/Queue/components/QueueBattleItem/',
  // Trivia took the same exemption with its arcade redesign: a round is a
  // cabinet attract mode on the TV and on the pads, set in Rubik Mono One with
  // neon glows, hard offset drops and its own four-key palette. The values are
  // in the trivia arcade design handoff.
  'routes/Player/components/PlayerTrivia/',
  'components/AnswerKey/',
  'components/TriviaDialog/',
  'components/TriviaPodium/',
  'components/TriviaRail/',
  'components/TriviaTally/',
]

/** True for a "path:line:text" row, or a bare path, inside Singer Battle. */
const isArcade = (line: string): boolean => ARCADE.some(dir => line.startsWith(dir))

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

describe('DECK rules', () => {
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

  it('has no glow: no drop-shadow filters, no text-shadow', () => {
    // "There is no glow anywhere — an indicator is lit by being amber, not by
    // bleeding light."
    //
    // The rule bans GLOW: light bleeding outward from the type, which is what
    // the old brand did in colour. A plain dark drop behind type that sits
    // over arbitrary video is the opposite — it subtracts light to keep the
    // type readable, and the handoff's own PlayerHeadline.jsx carries it.
    // Allowed only there, and only in black: any coloured or zero-offset
    // shadow is a glow again and still fails.
    // the sole exception, pinned to the file AND the exact declaration
    const LEGIBILITY_SHADOW = new RegExp(
      '^routes/Player/components/PlayerTextOverlay/PlayerHeadline/PlayerHeadline\\.css:'
      + '\\d+:\\s*text-shadow: 0 2px 12px rgba\\(0, 0, 0, \\.8\\);$')

    expect(search('filter:\\s*drop-shadow', '*.css').filter(l => !isArcade(l))).toEqual([])
    expect(search('text-shadow:', '*.css')
      .filter(l => !/text-shadow:\s*none/.test(l))
      .filter(l => !LEGIBILITY_SHADOW.test(l))
      // Singer Battle's hard offset drop (3px 3px 0 #000) is arcade chrome,
      // not a glow — it bleeds no light, it stamps the type onto the stage.
      .filter(l => !isArcade(l))).toEqual([])
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

  it('defines no colour outside the token file', () => {
    // The palette is closed. A raw hex in a component is a fifth colour
    // sneaking in without the "do you want a fifth indicator?" conversation.
    const hex = search('#[0-9a-fA-F]{3,8}\\b', '*.css')
      .filter(l => !l.startsWith('styles/variables.css'))
      // data: URIs carry encoded SVG markup, not palette
      .filter(l => !/url\("data:/.test(l))
      // Singer Battle carries its own closed palette, in its own files
      .filter(l => !isArcade(l))
    expect(hex).toEqual([])
  })

  it('keeps Michroma off the app, reserved for the wordmark and player', () => {
    // "Michroma — the wordmark and the player... never more than three words."
    const uses = search('--font-display', '*.css')
      // styles/ is where the token is defined and documented, not used
      .filter(l => !l.startsWith('styles/'))
      .filter(l => !/^(components\/Logo|routes\/Player)\//.test(l))
      // YourTurn's wait is the one sanctioned exception: "the one number in
      // the app set in Michroma", readable at arm's length in a dark room
      .filter(l => !l.startsWith('components/Header/YourTurn/'))
      // Singer Battle is display type throughout — fighter names, VS, WHO
      // WINS?, the verdict. It is the arcade cabinet, not the deck.
      .filter(l => !isArcade(l))
    expect(uses).toEqual([])
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
      // Singer Battle dims art, not rows: an unpicked fighter at .72, a taken
      // one at .3, a spent lockup at .4. There is nothing underneath to ghost
      // through, and the whole read of the select grid is built on it.
      if (isArcade(file)) continue

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
