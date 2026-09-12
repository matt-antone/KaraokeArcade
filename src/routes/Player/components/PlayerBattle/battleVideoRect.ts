import type { BattleSide } from 'shared/types'

/**
 * Where the karaoke video goes on a singing beat.
 *
 * The stage draws a bezel with a hole in it and the real player is mounted
 * underneath — so on `sing1` and `sing2` the plate is clipped and the video
 * shows through the opening. That only looks right if the video is actually
 * the size of the opening. Left at full screen it is `object-fit: contain`
 * across the whole display and what reaches the hole is a crop of its middle,
 * which loses the lyrics down whichever edge the sprite is standing on — the
 * one part of the screen a person singing is actually reading.
 *
 * So the same numbers that position the bezel in PlayerBattle.css are resolved
 * here in pixels and handed to Player. They are native design units off
 * TV-MAIN-SCREEN.md and have to stay in step with the `.video` rules in that
 * stylesheet: the video panel is `top: 63`, `bottom: 31`, and starts 132 units
 * in on the singer's side — the sprite keeps the outer third and the video
 * takes the rest, mirrored between the two beats.
 */

/** The stage's own box: 384 x 224 design units, the dive bar plate's 12:7. */
const STAGE_W = 384
const STAGE_H = 224

/** The opening, in those same units. 384 - 132 - 28 and 224 - 63 - 31. */
const PANEL_W = 224
const PANEL_H = 130
const PANEL_TOP = 63
/** How far in the panel starts on the side the singer is standing. The other
 *  beat mirrors it, which is the whole of the difference between them. */
const PANEL_NEAR = 132
const PANEL_FAR = STAGE_W - PANEL_NEAR - PANEL_W

export interface BattleVideoRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * `width` and `height` are the player's whole display. The stage is centred in
 * it by `place-items: center` and keeps its aspect ratio, so it is whichever
 * of the two axes runs out first that decides its size — on a 16:9 screen that
 * is the height, leaving the ~1.8% of pillarbox either side the stylesheet
 * mentions.
 */
export default function battleVideoRect (width: number, height: number, side: BattleSide): BattleVideoRect {
  const stageW = Math.min(width, height * (STAGE_W / STAGE_H))
  const stageH = stageW * (STAGE_H / STAGE_W)
  const px = stageW / STAGE_W

  const stageLeft = (width - stageW) / 2
  const stageTop = (height - stageH) / 2

  // Side 1 sings from the left, so the video sits right; side 2 mirrors it.
  const inset = side === 1 ? PANEL_NEAR : PANEL_FAR

  return {
    left: Math.round(stageLeft + (inset * px)),
    top: Math.round(stageTop + (PANEL_TOP * px)),
    width: Math.round(PANEL_W * px),
    height: Math.round(PANEL_H * px),
  }
}
