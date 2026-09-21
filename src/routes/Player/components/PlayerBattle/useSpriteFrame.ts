import { useEffect } from 'react'
import useNow from 'lib/useNow'
import { useFighterSet } from 'lib/fighterSets'
import {
  ONE_SHOT_SETS,
  battleSingerCell,
  battleSingerLoop,
  battleSingerSet,
  setFrameMs,
  type BattleSingerLoop,
  type RosterSinger,
  type SpriteCell,
} from 'lib/battleSingers'

/**
 * The frame of a fighter's animation that is on screen right now.
 *
 * Cycling sets — `sing`, `dance` — take their index from the wall clock rather
 * than from a counter, so two fighters mounted at different moments (the
 * versus card's pair, the winner arriving over the beat before it) are on the
 * same frame as each other, and neither drifts across a two-minute song.
 *
 * One-shot sets — `ko`, `victory` — play once and hold their last frame, and
 * so need `elapsedMs`: how far into the animation the room is. Unlike a cycle
 * there is a right moment for frame 0, and a wall-clock index would drop the
 * fighter into the middle of their own knockdown.
 *
 * It is elapsed time rather than a start stamp because this runs on a TV box
 * whose clock disagrees with the server's, often by minutes. The caller has
 * the corrected figure already — useBattleStage's msLeft is measured through
 * serverNow — so handing that difference down is both right and one fewer
 * clock in here.
 *
 * That correction is pinned to the moment this device first saw the payload,
 * which on the LAN these boxes share is within a hop of when it was sent. A
 * display that joins halfway through a verdict therefore plays the knockdown
 * from the top rather than catching the end of it — the same assumption every
 * countdown on the stage already makes, and the reason a remount mid-beat
 * restarts the animation rather than freezing it.
 *
 * Without `elapsedMs` a one-shot holds its last frame, which is the pose that
 * reads correctly for a beat already under way.
 *
 * The sheet is fetched on mount. A set is one file, so this is one request
 * that either is in cache or is not; there is no longer a per-frame stall to
 * pre-empt, which is the main thing the packed sheets bought.
 *
 * The rate is the set's own, off the fighter's manifest, not one rate for the
 * room: a dance traced from a two-second step is 24 frames at 12fps while the
 * ko beside it is sixteen at 8. Two fighters at the same rate still share a
 * frame, because the index is still the wall clock divided by the period
 * rather than a counter — they need no clock between them to agree, and two
 * at different rates have nothing to agree about.
 *
 * `want` is what the beat would like to see, not what it gets: a fighter
 * missing the set that was asked for falls back to one they have rather than
 * to a 404, which is battleSingerLoop's job.
 */
export default function useSpriteFrame (
  singer: RosterSinger,
  want: BattleSingerLoop,
  elapsedMs?: number,
): SpriteCell {
  const loop = battleSingerLoop(singer, want)
  const set = useFighterSet(singer.group, singer.slug, loop, battleSingerSet(singer, loop))
  const frameMs = setFrameMs(set)
  const now = useNow(frameMs)

  useEffect(() => {
    const img = new Image()
    img.src = battleSingerCell(singer, loop, 0).url
  }, [loop, singer])

  // The cell is cut from `set` rather than from `singer.loops`, which for a
  // fighter resolved off a queue row is still the default sixteen.
  const drawn = { ...singer, loops: { ...singer.loops, [loop]: set } }

  if (ONE_SHOT_SETS.has(loop)) {
    const last = set.frames - 1
    const frame = elapsedMs === undefined ? last : Math.floor(elapsedMs / frameMs)

    return battleSingerCell(drawn, loop, Math.min(last, Math.max(0, frame)))
  }

  return battleSingerCell(drawn, loop, Math.floor(now / frameMs))
}
