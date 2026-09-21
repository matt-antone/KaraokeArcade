import { useMemo } from 'react'
import { useFighterListing } from 'lib/fighterSets'
import {
  BATTLE_SINGERS,
  DEFAULT_GROUP,
  battleSingerAt,
  type RosterSinger,
} from 'lib/battleSingers'

export interface BattleGroup {
  name: string
  singers: RosterSinger[]
}

/** Until the folders are listed — or if listing fails — the room still has the
 *  shipped eight to pick from. */
const SHIPPED: BattleGroup[] = [{ name: DEFAULT_GROUP, singers: BATTLE_SINGERS }]

/** Every fighter group on disk, default first.
 *
 *  The listing carries each fighter's manifest alongside their folder name, so
 *  a fighter built here is drawn on their own frame count and fps rather than
 *  on the defaults — which is what the chooser's preview sprites need, and the
 *  same data the stage reads through useFighterSet. */
export default function useBattleGroups (): BattleGroup[] {
  const listing = useFighterListing()

  return useMemo(() => {
    const groups = Object.entries(listing)
      .map(([group, fighters]) => ({
        name: group,
        singers: Object.entries(fighters).map(([slug, sets]) => battleSingerAt(group, slug, sets)),
      }))
      // shipped fighters keep their p1–p8 order; everyone else is alphabetical
      .map(g => (g.name === DEFAULT_GROUP
        ? {
            ...g,
            singers: [...g.singers].sort((a, b) =>
              BATTLE_SINGERS.findIndex(s => s.slug === a.slug) - BATTLE_SINGERS.findIndex(s => s.slug === b.slug)),
          }
        : g))
      .filter(g => g.singers.length)
      // default first, then the rest by name
      .sort((a, b) => Number(b.name === DEFAULT_GROUP) - Number(a.name === DEFAULT_GROUP) || a.name.localeCompare(b.name))

    return groups.length ? groups : SHIPPED
  }, [listing])
}
