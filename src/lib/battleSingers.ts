/** The Singer Battle roster.
 *
 *  Fighters live in groups: one folder per group under assets/battle/fighters,
 *  one folder per fighter inside it. `default` ships with the app; an admin
 *  adds a group by dropping a folder of fighters next to it, and turns it on
 *  per room in Settings. The server lists the folders (GET /api/prefs/fighters)
 *  and otherwise never holds the roster — only the id a fighter picked, which
 *  is a short string on the invite and the queue row.
 *
 *  A fighter's id is its `group/slug` path, so anything that only has an id —
 *  the stage, the queue, the vote — can draw it without the list. The eight
 *  default fighters keep the p1–p8 ids they had before groups, because those
 *  are already written onto queue rows and phones' last picks.
 */

/** Where the art is served from. `assets/` is koa-static'd off KES_PATH_ASSETS
 *  (server/serverWorker.ts), so these are plain relative URLs — the same way
 *  soundCue.ts names its mp3s. Nothing here goes through the bundler. */
const ART = 'assets/battle'
const FIGHTERS = `${ART}/fighters`

/** The cell a sheet is cut into. Still the artist's number rather than ours,
 *  and still written into the aspect-ratio in BattleSprite.css and
 *  PlayerBattle.css, which is why it stays a constant while the grid around it
 *  no longer is. Every delivered manifest carries the same 560; the day one
 *  does not, these two are what has to move with it. */
export const FRAME_WIDTH = 560
export const FRAME_HEIGHT = 560

/** How one set of one fighter is cut and played.
 *
 *  All three of these used to be constants, on the assumption that every sheet
 *  was sixteen frames of a two-row grid at 8fps. That held until the art
 *  started tracing each dance from its own motion source: a step whose natural
 *  cycle is two seconds comes back as 24 frames at 12fps, and played on the
 *  old clock it ran two thirds of the loop at two thirds speed. So the numbers
 *  come from the fighter's manifest.json now, per set — two fighters can
 *  disagree about `dance`, and one fighter can disagree with themself between
 *  `dance` and `ko`.
 *
 *  `columns` is here for the same reason as `fps` rather than because anything
 *  ships a different grid today. Nothing does. Leaving it hardcoded next to
 *  two fields that are read would be the identical trap one field over. */
export interface SetSpec {
  frames: number
  fps: number
  columns: number
}

/** What a set is until its manifest says otherwise: the grid every sheet was
 *  cut to before the manifests existed. A fighter whose manifest is missing or
 *  unreadable draws on these rather than not drawing — a sixteen-frame read of
 *  a 24-frame sheet is wrong, but it is a fighter on the stage, and the
 *  alternative on a TV box mid-battle is an empty box. */
export const DEFAULT_SET: SetSpec = { frames: 16, fps: 8, columns: 8 }

/** A set's frame period in ms, which is what the sprite clock ticks on. */
export const setFrameMs = (set: SetSpec): number => 1000 / set.fps

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
  /** The group folder under assets/battle/fighters. */
  group: string
  /** The fighter's folder inside its group. Separate from `id` because the
   *  default fighters' ids predate groups and cannot be renamed. */
  slug: string
  /** Roster name, always drawn in caps. Not a person's name — the person keeps
   *  their own handle and this is who they are singing as. */
  name: string
  /** How each set is cut and played. A set absent from here is not drawn for
   *  this fighter and callers fall back to one that is. */
  loops: Partial<Record<BattleSingerLoop, SetSpec>>
}

/** The four sets on the default spec, for a fighter whose manifest has not
 *  arrived yet. The server reads the real numbers off disk and hands them down
 *  with the roster — see fighterSets.ts — so this is the shape, not the truth. */
const LOOPS: Record<BattleSingerLoop, SetSpec> = {
  sing: DEFAULT_SET,
  dance: DEFAULT_SET,
  ko: DEFAULT_SET,
  victory: DEFAULT_SET,
}

export const DEFAULT_GROUP = 'default'

const fighter = (
  id: string,
  group: string,
  slug: string,
  name = slug.replace(/-/g, ' ').toUpperCase(),
  loops: Partial<Record<BattleSingerLoop, SetSpec>> = LOOPS,
): RosterSinger => ({ id, group, slug, name, loops })

/** The shipped group, in select-grid order, under the ids they had before
 *  groups existed. */
export const BATTLE_SINGERS: RosterSinger[] = [
  fighter('p1', DEFAULT_GROUP, 'belter'),
  fighter('p2', DEFAULT_GROUP, 'crooner'),
  fighter('p3', DEFAULT_GROUP, 'hype-man', 'HYPEMAN'),
  fighter('p4', DEFAULT_GROUP, 'diva'),
  fighter('p5', DEFAULT_GROUP, 'screamer'),
  fighter('p6', DEFAULT_GROUP, 'outlaw'),
  fighter('p7', DEFAULT_GROUP, 'idol'),
  fighter('p8', DEFAULT_GROUP, 'heavyweight'),
]

/** A folder name that is safe to put in a url(). Ids arrive from other phones
 *  by way of the server, which only caps their length, so this is the check
 *  that keeps one from writing into the stage's CSS. */
const NAME = /^[a-z0-9][a-z0-9_-]*$/i

export const isBattleFolderName = (name: string): boolean => NAME.test(name)

/** The fighter at `group/slug`, reusing a default fighter's legacy id.
 *
 *  `loops` is the fighter's manifest if the caller has it. Nobody resolving a
 *  fighter from an id alone does — a queue row carries `halloween/deb`, not
 *  her frame counts — so the default is the shape and useFighterSet supplies
 *  the numbers once the roster has been listed. */
export const battleSingerAt = (
  group: string,
  slug: string,
  loops?: Partial<Record<BattleSingerLoop, SetSpec>>,
): RosterSinger => {
  const shipped = group === DEFAULT_GROUP && BATTLE_SINGERS.find(s => s.slug === slug)

  if (shipped) return loops ? { ...shipped, loops } : shipped

  return fighter(`${group}/${slug}`, group, slug, undefined, loops)
}

const getBattleSinger = (id?: string | null): RosterSinger | null => {
  if (!id) return null

  const legacy = BATTLE_SINGERS.find(s => s.id === id)
  if (legacy) return legacy

  const [group, slug, ...rest] = id.split('/')

  return !rest.length && slug && isBattleFolderName(group) && isBattleFolderName(slug)
    ? battleSingerAt(group, slug)
    : null
}

/** The fighter to draw for an id, falling back to the first default fighter.
 *  A battle started before the roster shipped has no id recorded, and a stage
 *  with nobody standing on it is worse than a stage with the default. */
export const battleSingerOrDefault = (id?: string | null): RosterSinger =>
  getBattleSinger(id) ?? BATTLE_SINGERS[0]

/** Whether a room shows a group. `default` is on unless a host turns it off;
 *  any other group is off until one turns it on. */
export const isBattleGroupOn = (groups: Record<string, boolean> | undefined, group: string): boolean =>
  (group === DEFAULT_GROUP ? groups?.[group] !== false : groups?.[group] === true)

/** Which set this fighter can actually show for the one that was asked for.
 *  Every drawn fighter has all four today, so this only does anything if a
 *  future slot lands with one of them missing. */
export const battleSingerLoop = (singer: RosterSinger, want: BattleSingerLoop): BattleSingerLoop => {
  if (singer.loops[want]) return want

  return (Object.keys(singer.loops)[0] as BattleSingerLoop) ?? 'sing'
}

/** How this fighter's set is cut and played, defaulted rather than absent: a
 *  caller has already been through battleSingerLoop and is drawing something. */
export const battleSingerSet = (singer: RosterSinger, loop: BattleSingerLoop): SetSpec =>
  singer.loops[loop] ?? DEFAULT_SET

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
  const { frames: count, columns } = battleSingerSet(singer, loop)
  const frame = ((tick % count) + count) % count

  return {
    url: `${FIGHTERS}/${singer.group}/${singer.slug}/${loop}-sheet.png`,
    cols: columns,
    rows: Math.ceil(count / columns),
    col: frame % columns,
    row: Math.floor(frame / columns),
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

const view = (singer: RosterSinger, name: string) => `${FIGHTERS}/${singer.group}/${singer.slug}/views/${name}.png`

const pose = (singer: RosterSinger, name: string): SpriteCell =>
  ({ url: view(singer, name), cols: 1, rows: 1, col: 0, row: 0 })

/** Single poses. `key` is the tile pose, `front` the full-bleed hero. */
export const battleSingerKeyArt = (singer: RosterSinger): SpriteCell => pose(singer, 'key')

export const battleSingerFrontArt = (singer: RosterSinger): SpriteCell => pose(singer, 'front')

/** The square head crop. Two cuts of the same drawing, named for the size they
 *  are meant to be drawn at and delivered at 4× that: 34 for a chip or a grid
 *  tile, 80 for a hero slot or a versus plate. Asking for the small one where
 *  the big one belongs is a blurry fighter, not a broken one. */
export const battleSingerPortrait = (singer: RosterSinger, size: 34 | 80 = 34): string =>
  view(singer, `portrait-${size}`)

/** The one non-pixel asset in the set: render it with `image-rendering: auto`. */
export const BATTLE_LOCKUP = `${ART}/logo-singer-battle.png`

/** The only finished stage plate. Wider than the stage's 12:7 on purpose so it
 *  can pan; ballroom and rooftop are specced but not drawn. */
export const BATTLE_STAGE_PLATE = `${ART}/stage-dive-bar.png`
