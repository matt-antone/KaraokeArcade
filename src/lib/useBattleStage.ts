import { useAppSelector } from 'store/hooks'
import serverNow from './serverNow'
import useNow from './useNow'
import type { BattlePhase, BattleSide, BattleTurn } from 'shared/types'

/** Which fighter a beat belongs to. `null` is a beat about both of them, or
 *  about neither.
 *
 *  Lives beside the hook because the player and the phone draw the same nine
 *  beats and both need this answer. One table rather than six ternaries
 *  scattered down a render, and one table rather than two: the phase-to-side
 *  mapping is the thing most likely to be got wrong in one place and right in
 *  five, and a second copy is how the two screens end up disagreeing about who
 *  is singing. */
const SIDE_OF: Partial<Record<BattlePhase, BattleSide>> = {
  intro1: 1,
  sing1: 1,
  meter1: 1,
  intro2: 2,
  sing2: 2,
  meter2: 2,
}

export const sideOfPhase = (phase: BattlePhase | null): BattleSide | null =>
  (phase ? SIDE_OF[phase] ?? null : null)

/**
 * The battle beat on stage right now, or nothing.
 *
 * Same split as useTriviaStage, for the same reason: the store keeps the last
 * BattleTurn until the next one arrives, which is right for a store and wrong
 * for a screen. A finished 'winner' beat would keep the verdict up over the
 * following song. Expiry is a matter of time passing, so it belongs in a hook,
 * and both the player and the phone draw the same battle, so it lives in one.
 *
 * Unlike trivia, this ticks rather than arming a single timeout for the
 * deadline. Every beat of a battle is either a countdown or a meter filling,
 * so its consumers were going to call useNow anyway — one shared tick here is
 * one fewer clock to drift. The interval collapses to a minute when nothing is
 * on stage: the hook is mounted for the whole night and a 4Hz re-render of an
 * idle player is not free.
 *
 * msLeft is derived from that same tick rather than stored, so there is no
 * setState in an effect and nothing to get stale — the react-compiler and the
 * react-hooks purity rules both being errors on src/**.
 */
export default function useBattleStage (): { turn: BattleTurn | null, phase: BattlePhase | null, msLeft: number } {
  const turn = useAppSelector(state => state.battle.turn)
  const tick = useNow(turn ? 250 : 60000)

  // Math.max rather than an early return for the already-expired case: a
  // payload that arrives after its own deadline (a long beat on a slow link)
  // still reads as zero remaining and lets the next tick move past it, instead
  // of needing state set during render.
  const msLeft = turn ? Math.max(0, turn.endsAt - serverNow(turn, tick)) : 0

  // Never turn.endsAt against Date.now(): a phone whose clock runs two minutes
  // fast walks straight past every beat and shows the room nothing at all.
  const isLive = !!turn && turn.endsAt > serverNow(turn, tick)

  // The whole thing goes null together. A phase with no turn behind it, or a
  // turn with an expired phase, is a half-drawn screen either way.
  return {
    turn: isLive ? turn : null,
    phase: isLive ? turn.phase : null,
    msLeft: isLive ? msLeft : 0,
  }
}
