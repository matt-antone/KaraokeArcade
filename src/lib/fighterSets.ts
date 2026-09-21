import { useSyncExternalStore } from 'react'
import HttpApi from 'lib/HttpApi'
import {
  DEFAULT_SET,
  isBattleFolderName,
  type BattleSingerLoop,
  type SetSpec,
} from 'lib/battleSingers'

/**
 * How every fighter on disk is cut and played, keyed `group/slug`.
 *
 * The server reads each fighter's manifest.json while it is already walking
 * the folders for the chooser (GET /api/prefs/fighters), so this is the same
 * one request the chooser makes, shared rather than made twice.
 *
 * It is a store rather than a value returned from the fetch because the two
 * things that need it arrive by different routes. The chooser asks for the
 * roster and gets the numbers with it. The stage never asks: it resolves a
 * fighter from an id on a queue row — `halloween/deb` — and starts drawing.
 * Keying the numbers to the chooser's request would leave the stage on the
 * defaults, which for the six fighters whose dance is 24 frames at 12fps is
 * exactly the bug the manifests exist to stop.
 */
type FighterSets = Partial<Record<BattleSingerLoop, SetSpec>>

/** What the endpoint hands back, once per page load. */
type Listing = Record<string, Record<string, FighterSets>>

const api = new HttpApi('prefs')

/** Empty until the listing lands. A stable identity matters: useSyncExternalStore
 *  re-renders on a changed snapshot, so handing back a fresh {} each read would
 *  loop. */
const NONE: Listing = {}

let listing: Listing = NONE
let request: Promise<Listing> | null = null
const listeners = new Set<() => void>()

const publish = (next: Listing) => {
  listing = next
  for (const notify of listeners) notify()

  return next
}

/** ponytail: fetched once per page load, like the chooser's listing it replaces.
 *  A fighter folder dropped in mid-session shows after a reload, which is also
 *  when an admin would go and switch its group on. */
const load = () => {
  request ??= api.get<Listing>('/fighters')
    .then(raw => publish(Object.fromEntries(
      Object.entries(raw ?? {})
        .filter(([group]) => isBattleFolderName(group))
        .map(([group, slugs]) => [group, Object.fromEntries(
          Object.entries(slugs ?? {}).filter(([slug]) => isBattleFolderName(slug)),
        )]),
    )))
    .catch(() => {
      // Leave the defaults in place and let the next mount try again: the
      // fighters still draw, on the grid they were cut to before manifests.
      request = null

      return listing
    })

  return request
}

const subscribe = (notify: () => void) => {
  listeners.add(notify)
  void load()

  return () => {
    listeners.delete(notify)
  }
}

/** Every fighter's sets. Empty until the listing lands. */
export const useFighterListing = (): Listing =>
  useSyncExternalStore(subscribe, () => listing, () => NONE)

/** How one set of one fighter is cut and played.
 *
 *  Falls back to the fighter's own `loops` — which the chooser fills in from
 *  this same listing, and which is the default grid for a fighter resolved
 *  from a bare id — so this returns something drawable on the first render,
 *  before the request has landed. */
export const useFighterSet = (
  group: string,
  slug: string,
  loop: BattleSingerLoop,
  fallback: SetSpec = DEFAULT_SET,
): SetSpec => useFighterListing()[group]?.[slug]?.[loop] ?? fallback
