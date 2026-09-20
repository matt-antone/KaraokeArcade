import { useEffect, useState } from 'react'
import HttpApi from 'lib/HttpApi'
import {
  BATTLE_SINGERS,
  DEFAULT_GROUP,
  battleSingerAt,
  isBattleFolderName,
  type RosterSinger,
} from 'lib/battleSingers'

export interface BattleGroup {
  name: string
  singers: RosterSinger[]
}

/** Until the folders are listed — or if listing fails — the room still has the
 *  shipped eight to pick from. */
const SHIPPED: BattleGroup[] = [{ name: DEFAULT_GROUP, singers: BATTLE_SINGERS }]

const api = new HttpApi('prefs')

// ponytail: fetched once per page load; a group dropped in mid-session shows
// after a reload, which is also when an admin would go and switch it on.
let request: Promise<BattleGroup[]> | null = null

const load = () => {
  request ??= api.get<Record<string, string[]>>('/fighters')
    .then(folders => Object.entries(folders)
      .filter(([group]) => isBattleFolderName(group))
      .map(([group, slugs]) => ({
        name: group,
        singers: slugs.filter(isBattleFolderName).map(slug => battleSingerAt(group, slug)),
      }))
      // shipped fighters keep their p1–p8 order; everyone else is alphabetical
      .map(g => (g.name === DEFAULT_GROUP
        ? { ...g, singers: g.singers.sort((a, b) => BATTLE_SINGERS.indexOf(a) - BATTLE_SINGERS.indexOf(b)) }
        : g))
      .filter(g => g.singers.length)
      // default first, then the rest by name
      .sort((a, b) => Number(b.name === DEFAULT_GROUP) - Number(a.name === DEFAULT_GROUP) || a.name.localeCompare(b.name)))
    .then(groups => (groups.length ? groups : SHIPPED))
    .catch(() => {
      request = null
      return SHIPPED
    })

  return request
}

/** Every fighter group on disk, default first. */
export default function useBattleGroups (): BattleGroup[] {
  const [groups, setGroups] = useState(SHIPPED)

  useEffect(() => {
    let isLive = true
    void load().then(g => isLive && setGroups(g))

    return () => {
      isLive = false
    }
  }, [])

  return groups
}
