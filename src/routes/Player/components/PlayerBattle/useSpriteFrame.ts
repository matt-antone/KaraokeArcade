import { useEffect } from 'react'
import useNow from 'lib/useNow'
import {
  FRAME_MS,
  battleSingerCell,
  battleSingerLoop,
  type BattleSingerLoop,
  type RosterSinger,
  type SpriteCell,
} from 'lib/battleSingers'

/**
 * The frame of a fighter's loop that is on screen right now.
 *
 * The index comes out of the wall clock rather than out of a counter, so two
 * fighters mounted at different moments — the versus card's pair, the winner
 * arriving over the beat before it — are on the same frame as each other, and
 * neither drifts across a two-minute song.
 *
 * The sheet is fetched on mount. A loop is one file, so this is one request
 * that either is in cache or is not; there is no longer a per-frame stall to
 * pre-empt, which is the main thing the packed sheets bought.
 *
 * `want` is what the beat would like to see, not what it gets: a fighter
 * missing the loop that was asked for falls back to one they have rather than
 * to a 404, which is battleSingerLoop's job.
 */
export default function useSpriteFrame (singer: RosterSinger, want: BattleSingerLoop): SpriteCell {
  const loop = battleSingerLoop(singer, want)
  const now = useNow(FRAME_MS)

  useEffect(() => {
    const img = new Image()
    img.src = battleSingerCell(singer, loop, 0).url
  }, [loop, singer])

  return battleSingerCell(singer, loop, Math.floor(now / FRAME_MS))
}
