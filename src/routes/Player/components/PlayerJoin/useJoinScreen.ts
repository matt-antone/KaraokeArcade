import { useEffect, useState } from 'react'
import { useAppSelector } from 'store/hooks'
import { crowdOf, seatsFor, type Seats } from './crowd'

/** How long each of the two idle screens holds before handing to the other. */
const SWAP_MS = 20000

/**
 * The room's crowd, seated against the last seating, never from scratch, so a
 * joiner or a leaver moves nobody else. Held across the scores swap too: the
 * join screen stays mounted while 14 is up. Adjusted during render rather than
 * in an effect, so a push re-seats in the same paint.
 */
export function useCrowd () {
  const singers = useAppSelector(state => state.rooms.singers)
  const [seated, setSeated] = useState<{ singers: typeof singers, seats: Seats }>(
    () => ({ singers, seats: seatsFor([], singers) }),
  )
  if (seated.singers !== singers) setSeated({ singers, seats: seatsFor(seated.seats, singers) })

  return crowdOf(seated.seats)
}

/** Whether 14 has the screen: once anyone has scored, 10 and 14 take turns. */
export function useIsScoresTurn (hasScores: boolean): boolean {
  const [isScores, setIsScores] = useState(false)

  useEffect(() => {
    if (!hasScores) return

    const intervalID = setInterval(() => setIsScores(is => !is), SWAP_MS)
    return () => clearInterval(intervalID)
  }, [hasScores])

  return hasScores && isScores
}
