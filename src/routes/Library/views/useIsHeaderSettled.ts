import { useEffect, useState } from 'react'

/**
 * Whether the header has settled at its height, so a virtualized list can be
 * laid out once rather than re-measured under the user.
 *
 * Settled means it grew after mount (arriving on a route whose header is
 * taller), or, failing that, that a moment has passed and it has any height
 * at all. Waiting only for growth left the library blank forever when arriving
 * from a tab whose header is the same height (Queue, since the arcade
 * redesign): it never grows. A resize that is coming lands within a frame; a
 * timer rather than requestAnimationFrame, which a hidden tab never runs.
 */
export default function useIsHeaderSettled (headerHeight: number): boolean {
  const [initialHeight] = useState(headerHeight)
  const [hasGrown, setHasGrown] = useState(false)
  const [hasWaited, setHasWaited] = useState(false)

  if (!hasGrown && headerHeight > initialHeight) setHasGrown(true)

  useEffect(() => {
    const id = setTimeout(() => setHasWaited(true), 50)
    return () => clearTimeout(id)
  }, [])

  return hasGrown || (hasWaited && headerHeight > 0)
}
