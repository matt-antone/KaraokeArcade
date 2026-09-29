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
 * here in pixels and handed to Player. They are Arcade Flow v2's 13e/13g
 * panel at 0.4 (the design's 960 x 540 TV is 384 x 216 units): 305.6 x 172,
 * 33.6 from the top, 67.2 in from the left on round 1 and 11.2 on round 2 —
 * the singer keeps the outer side and the video takes the rest, mirrored
 * between the two beats.
 */

/** The stage's own box: 384 x 216 design units, the design's 16:9. */
const STAGE_W = 384
const STAGE_H = 216

/** The opening, in those same units. */
const PANEL_W = 305.6
const PANEL_H = 172
const PANEL_TOP = 33.6
/** How far in the panel starts on the side the singer is standing. The other
 *  beat mirrors it, which is the whole of the difference between them. */
const PANEL_NEAR = 67.2
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
 * of the two axes runs out first that decides its size — on a 16:9 screen,
 * neither: it fills the display.
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
