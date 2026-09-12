import { useEffect } from 'react'
import useNow from 'lib/useNow'
import {
  battleSingerFrame,
  battleSingerFrameCount,
  battleSingerLoop,
  type BattleSingerLoop,
  type RosterSinger,
} from 'lib/battleSingers'

/** Every delivered loop is drawn at 8fps and is seamless at that rate. */
const FRAME_MS = 125

/**
 * The frame of a fighter's loop that is on screen right now.
 *
 * The index comes out of the wall clock rather than out of a counter, so two
 * fighters mounted at different moments — the versus card's pair, the winner
 * arriving over the beat before it — are on the same frame as each other, and
 * neither drifts across a two-minute song.
 *
 * Every frame is fetched on mount. Without it the first cycle of a loop stalls
 * once per frame while each PNG decodes, which on an eight-frame loop is the
 * whole first second of a beat and on the sixteen-frame fighter is two — and it
 * happens again at the start of every beat, because each one wants a different
 * loop. A fighter is at most sixteen 512px frames and only the two on stage are
 * ever asked for.
 *
 * `want` is what the beat would like to see, not what it gets: a wave-1 fighter
 * with only an idle loop drawn falls back to it rather than to a 404, which is
 * battleSingerLoop's job.
 */
export default function useSpriteFrame (singer: RosterSinger, want: BattleSingerLoop): string {
  const loop = battleSingerLoop(singer, want)
  const count = battleSingerFrameCount(singer, loop)
  const now = useNow(FRAME_MS)

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      const img = new Image()
      img.src = battleSingerFrame(singer, loop, i)
    }
  }, [count, loop, singer])

  return battleSingerFrame(singer, loop, Math.floor(now / FRAME_MS))
}
