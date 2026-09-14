/** The Singer Battle roster.
 *
 *  Nine slots, two of them drawn. This is static client data rather than a
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

/** The loops a fighter can be drawn in. Every delivered set is 8fps and
 *  seamless; which one a beat uses is the beat's business. `idle` is the
 *  fallback for the six fighters who only have that. */
export type BattleSingerLoop = 'idle' | 'sing' | 'dance'

export interface RosterSinger {
  id: string
  /** Roster name, always drawn in caps. Not a person's name — the person keeps
   *  their own handle and this is who they are singing as. */
  name: string
  /** No art drawn yet: the tile renders as a locked `?` and cannot be picked. */
  pending?: boolean
  /** Frame counts per loop. A loop absent from here is not drawn for this
   *  fighter and callers fall back to `idle`. */
  loops: Partial<Record<BattleSingerLoop, number>>
  /** Whether the large select-screen portrait exists. p2 has no `-80` and
   *  nothing may assume one — see ASSETS.md. */
  hasLargePortrait: boolean
}

/** Ordered as the select grid draws them. The two finished fighters lead so
 *  the grid opens on something rather than on seven question marks. */
export const BATTLE_SINGERS: RosterSinger[] = [
  { id: 'p2', name: 'CROONER', loops: { sing: 16, dance: 16 }, hasLargePortrait: false },
  { id: 'p1', name: 'BELTER', loops: { sing: 8, dance: 8 }, hasLargePortrait: true },
  { id: 'p3', name: 'HYPEMAN', pending: true, loops: { idle: 4 }, hasLargePortrait: true },
  { id: 'p4', name: 'DIVA', pending: true, loops: { idle: 4 }, hasLargePortrait: true },
  { id: 'p5', name: 'SCREAMER', pending: true, loops: { idle: 4 }, hasLargePortrait: true },
  { id: 'p6', name: 'OUTLAW', pending: true, loops: { idle: 4 }, hasLargePortrait: true },
  { id: 'p7', name: 'IDOL', pending: true, loops: { idle: 4 }, hasLargePortrait: true },
  { id: 'p8', name: 'HEAVYWEIGHT', pending: true, loops: { idle: 4 }, hasLargePortrait: true },
  { id: 'p9', name: 'TBD', pending: true, loops: {}, hasLargePortrait: false },
]

/** The ones a person can actually be. Never empty — the grid's sticky
 *  selection depends on there being something to fall back to. */
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

/** Which loop this fighter can actually show for the one that was asked for.
 *  Asking a wave-1 fighter to sing gets their idle rather than a broken URL. */
export const battleSingerLoop = (singer: RosterSinger, want: BattleSingerLoop): BattleSingerLoop => {
  if (singer.loops[want]) return want
  if (singer.loops.idle) return 'idle'

  // Something is drawn for every non-pending fighter, so this only happens on
  // a pending slot, which no beat draws a loop for anyway.
  return (Object.keys(singer.loops)[0] as BattleSingerLoop) ?? 'idle'
}

export const battleSingerFrameCount = (singer: RosterSinger, loop: BattleSingerLoop): number =>
  singer.loops[loop] ?? 1

/** One frame of a loop. Frames are 1-based on disk and the index wraps, so a
 *  caller can hand this a monotonically increasing tick and stop thinking
 *  about it.
 *
 *  ponytail: individual PNGs rather than the packed sprite sheet ASSETS.md
 *  asks for — the frames ship as separate files and packing them needs a build
 *  step this repo does not have. Swapping one element's background-image per
 *  frame is not the stacked-<img> cross-fade the handoff warns against, and
 *  the sheet can be dropped in later behind this one function. */
export const battleSingerFrame = (singer: RosterSinger, loop: BattleSingerLoop, tick: number): string => {
  const count = battleSingerFrameCount(singer, loop)
  const frame = (((tick % count) + count) % count) + 1

  return `${ART}/${singer.id}-${loop}-${String(frame).padStart(2, '0')}.png`
}

/** Single poses. `key` is the 3:4-friendly tile pose, `front` the full-bleed
 *  hero. Both only exist for finished fighters. */
export const battleSingerKeyArt = (singer: RosterSinger): string | null =>
  (singer.pending ? null : `${ART}/${singer.id}-key.png`)

export const battleSingerFrontArt = (singer: RosterSinger): string | null =>
  (singer.pending ? null : `${ART}/${singer.id}-front.png`)

/** Square crop. `34` is the HUD chip, `80` the select tile. p2 has no `-80`,
 *  so that size falls back to the one that exists rather than 404ing. */
export const battleSingerPortrait = (singer: RosterSinger, size: 34 | 80): string =>
  `${ART}/${singer.id}-portrait-${size === 80 && !singer.hasLargePortrait ? 34 : size}.png`

/** The one non-pixel asset in the set: render it with `image-rendering: auto`. */
export const BATTLE_LOCKUP = `${ART}/logo-singer-battle.png`

/** The only finished stage plate. Wider than the stage's 12:7 on purpose so it
 *  can pan; ballroom and rooftop are specced but not drawn. */
export const BATTLE_STAGE_PLATE = `${ART}/stage-dive-bar.png`
