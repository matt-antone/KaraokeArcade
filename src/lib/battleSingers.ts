/** The Singer Battle roster.
 *
 *  Nine slots, eight of them drawn. This is static client data rather than a
 *  table because a roster is art, not content: a slot exists when the artist
 *  has delivered the PNGs for it, and nothing an operator can do in Settings
 *  should be able to add a tenth. The server never holds the roster — only the
 *  id a fighter picked, which is a short string on the invite and the queue
 *  row.
 *
 *  Tiles are built from this list rather than from a hardcoded pair, so a slot
 *  lights up the moment its art lands and `pending` comes off. See
 *  docs/singer-battle/design/ASSETS.md for what is still missing.
 */

/** Where the art is served from. `assets/` is koa-static'd off KES_PATH_ASSETS
 *  (server/serverWorker.ts), so these are plain relative URLs — the same way
 *  soundCue.ts names its mp3s. Nothing here goes through the bundler. */
const ART = 'assets/battle'
const FIGHTERS = `${ART}/fighters`

/** Sheets are a fixed grid of 480×560 cells, eight to a row, however many rows
 *  the loop needs. Both numbers are the artist's, not ours: they are what the
 *  delivered sheets are cut to, and a sheet that disagreed would draw every
 *  frame slightly off rather than fail. battleSingers.test.ts measures them. */
export const SHEET_COLS = 8
export const FRAME_WIDTH = 480
export const FRAME_HEIGHT = 560

/** Every delivered set is drawn at 4fps. */
export const FRAME_MS = 250

/** The animation sets a fighter can be drawn in. Every fighter has all four.
 *  Belter's `entrance`, `flinch` and `guard` sheets are also delivered under
 *  assets/sprites/ but nothing plays them yet, so they are not copied in or
 *  named here — add the set and the sheet together.
 *
 *  Called `Loop` because two of the four are: `sing` and `dance` cycle
 *  seamlessly for as long as a beat lasts. `ko` and `victory` do not — see
 *  ONE_SHOT_SETS. */
export type BattleSingerLoop = 'sing' | 'dance' | 'ko' | 'victory'

/** The sets that play once and hold their last frame instead of cycling.
 *
 *  A ko ends with the fighter on the floor and a victory with their arm up,
 *  and neither drawing returns to where it started: cycling them pops the
 *  loser back onto their feet to be knocked down again every two seconds, and
 *  snaps the winner's arm back down mid-wave. useSpriteFrame reads this rather
 *  than taking a flag, so a caller cannot forget which kind it asked for. */
export const ONE_SHOT_SETS: ReadonlySet<BattleSingerLoop> = new Set<BattleSingerLoop>(['ko', 'victory'])

export interface RosterSinger {
  id: string
  /** The art directory this fighter's sheets live in. Separate from `id`
   *  because the id is written onto invites and queue rows and so cannot be
   *  renamed, while the folder is named for the character. Empty on a slot
   *  with no art, which nothing asks for a path to. */
  slug: string
  /** Roster name, always drawn in caps. Not a person's name — the person keeps
   *  their own handle and this is who they are singing as. */
  name: string
  /** No art drawn yet: the tile renders as a locked `?` and cannot be picked. */
  pending?: boolean
  /** Frame counts per set. A set absent from here is not drawn for this
   *  fighter and callers fall back to one that is. */
  loops: Partial<Record<BattleSingerLoop, number>>
}

/** Ordered as the select grid draws them, which is now simply p1 through p9:
 *  every drawn fighter is finished, so there is no longer a reason to lead
 *  with a subset. */
export const BATTLE_SINGERS: RosterSinger[] = [
  { id: 'p1', slug: 'belter', name: 'BELTER', loops: { sing: 8, dance: 16, ko: 8, victory: 8 } },
  { id: 'p2', slug: 'crooner', name: 'CROONER', loops: { sing: 8, dance: 16, ko: 8, victory: 8 } },
  { id: 'p3', slug: 'hype-man', name: 'HYPEMAN', loops: { sing: 8, dance: 16, ko: 8, victory: 8 } },
  { id: 'p4', slug: 'diva', name: 'DIVA', loops: { sing: 8, dance: 16, ko: 8, victory: 8 } },
  { id: 'p5', slug: 'screamer', name: 'SCREAMER', loops: { sing: 8, dance: 16, ko: 8, victory: 8 } },
  { id: 'p6', slug: 'outlaw', name: 'OUTLAW', loops: { sing: 8, dance: 16, ko: 8, victory: 8 } },
  { id: 'p7', slug: 'idol', name: 'IDOL', loops: { sing: 8, dance: 16, ko: 8, victory: 8 } },
  { id: 'p8', slug: 'heavyweight', name: 'HEAVYWEIGHT', loops: { sing: 8, dance: 16, ko: 8, victory: 8 } },
  { id: 'p9', slug: '', name: 'TBD', pending: true, loops: {} },
]

/** The ones a person can actually be. */
export const BATTLE_SINGERS_PLAYABLE = BATTLE_SINGERS.filter(s => !s.pending)

const getBattleSinger = (id?: string | null): RosterSinger | null =>
  (id ? BATTLE_SINGERS.find(s => s.id === id) ?? null : null)

/** The roster id to draw for a side, falling back to the first playable
 *  fighter. A battle started before this feature shipped has no id recorded,
 *  and a stage with nobody standing on it is worse than a stage with the
 *  default. */
export const battleSingerOrDefault = (id?: string | null): RosterSinger => {
  const singer = getBattleSinger(id)

  return singer && !singer.pending ? singer : BATTLE_SINGERS_PLAYABLE[0]
}

/** Which set this fighter can actually show for the one that was asked for.
 *  Every drawn fighter has all four today, so this only does anything if a
 *  future slot lands with one of them missing. */
export const battleSingerLoop = (singer: RosterSinger, want: BattleSingerLoop): BattleSingerLoop => {
  if (singer.loops[want]) return want

  // Something is drawn for every non-pending fighter, so this only falls
  // through on a pending slot, which no beat draws a loop for anyway.
  return (Object.keys(singer.loops)[0] as BattleSingerLoop) ?? 'sing'
}

export const battleSingerFrameCount = (singer: RosterSinger, loop: BattleSingerLoop): number =>
  singer.loops[loop] ?? 1

/**
 * One drawable thing: a cell of a grid, in a PNG.
 *
 * A frame of a loop and a single standing pose are the same shape here on
 * purpose — a pose is a 1×1 grid — so BattleSprite has one kind of thing to
 * draw and every caller hands it the same object whether it is animating or
 * not.
 */
export interface SpriteCell {
  url: string
  /** The grid `url` is cut into, and which cell of it to show. */
  cols: number
  rows: number
  col: number
  row: number
}

/** One frame of a set. The index wraps, so a caller animating a cycling set
 *  can hand this a monotonically increasing tick and stop thinking about it;
 *  a caller playing a one-shot clamps the tick itself and never reaches the
 *  wrap.
 *
 *  Frames run left to right and then wrap to the next row, which is how the
 *  sixteen-frame dance sheets are cut: two rows of eight. */
export const battleSingerCell = (singer: RosterSinger, loop: BattleSingerLoop, tick: number): SpriteCell => {
  const count = battleSingerFrameCount(singer, loop)
  const frame = ((tick % count) + count) % count

  return {
    url: `${FIGHTERS}/${singer.slug}/${loop}.png`,
    cols: SHEET_COLS,
    rows: Math.ceil(count / SHEET_COLS),
    col: frame % SHEET_COLS,
    row: Math.floor(frame / SHEET_COLS),
  }
}

/** Where a cell sits along one axis, as the percentage background-position
 *  wants it: the fraction of the way through the gaps between cells, of which
 *  there is one fewer than there are cells. A single-cell axis has no gaps to
 *  be a fraction of and sits at 0. */
const axis = (index: number, count: number) => (count > 1 ? `${(index / (count - 1)) * 100}%` : '0%')

/** The background declarations that put one cell of a sheet on screen.
 *
 *  Shared by the two sprite renderers — the phone's BattleSprite and the
 *  stage's BattleLoop — which disagree about how to size the box around a
 *  frame but not about how a frame is cut out of a sheet. Both size the
 *  background in whole multiples of the frame, which is what makes the
 *  position a plain percentage rather than something that has to solve for the
 *  box's width. */
export const spriteCellBackground = (cell: SpriteCell) => ({
  backgroundImage: `url('${cell.url}')`,
  backgroundSize: `${cell.cols * 100}% ${cell.rows * 100}%`,
  backgroundPosition: `${axis(cell.col, cell.cols)} ${axis(cell.row, cell.rows)}`,
})

const pose = (singer: RosterSinger, name: string): SpriteCell | null =>
  (singer.pending
    ? null
    : { url: `${FIGHTERS}/${singer.slug}/${name}.png`, cols: 1, rows: 1, col: 0, row: 0 })

/** Single poses. `key` is the tile pose, `front` the full-bleed hero. Both are
 *  null for a slot with no art drawn, and BattleSprite draws nothing for a
 *  null rather than fetching the page itself through `url('')`. */
export const battleSingerKeyArt = (singer: RosterSinger): SpriteCell | null => pose(singer, 'key')

export const battleSingerFrontArt = (singer: RosterSinger): SpriteCell | null => pose(singer, 'front')

/** The square head crop, for the HUD chip and anywhere else a fighter has to
 *  be named in a row of text. Cut from the same key pose the tiles draw, so it
 *  cannot drift out of step with the rest of a fighter's art the way the
 *  separately-drawn wave-1 portraits did. */
export const battleSingerPortrait = (singer: RosterSinger): string =>
  `${FIGHTERS}/${singer.slug}/portrait.png`

/** The one non-pixel asset in the set: render it with `image-rendering: auto`. */
export const BATTLE_LOCKUP = `${ART}/logo-singer-battle.png`

/** The only finished stage plate. Wider than the stage's 12:7 on purpose so it
 *  can pan; ballroom and rooftop are specced but not drawn. */
export const BATTLE_STAGE_PLATE = `${ART}/stage-dive-bar.png`
