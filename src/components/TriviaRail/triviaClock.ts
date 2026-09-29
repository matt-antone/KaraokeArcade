import serverNow from 'lib/serverNow'
import useNow from 'lib/useNow'
import type { TriviaRound } from 'shared/types'

/** "Q4 · Medium" */
export const questionMeta = (round: TriviaRound) =>
  `Q${round.questionNumber} · ${round.difficulty.charAt(0).toUpperCase()}${round.difficulty.slice(1)}`

/**
 * The round's countdown, as the TV and every phone read it: whole seconds
 * rounded up, as m:ss, and the share of the countdown still to run. One hook
 * because a pad that says 4 while the screen says 6 is worse than a pad with
 * no clock at all. `sentAt` is the moment the server opened answering, so the
 * pair of stamps is the whole countdown.
 */
export const useTriviaClock = (round: TriviaRound) => {
  const left = round.endsAt - serverNow(round, useNow())
  const secondsLeft = Math.max(0, Math.ceil(left / 1000))

  return {
    secondsLeft,
    clock: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`,
    fraction: Math.min(1, Math.max(0, left / Math.max(1, round.endsAt - round.sentAt))),
  }
}
