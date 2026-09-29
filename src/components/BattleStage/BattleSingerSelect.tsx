import React, { useState } from 'react'
import clsx from 'clsx'
import {
  BATTLE_STAGE_PLATE,
  DEFAULT_GROUP,
  battleSingerOrDefault,
  battleSingerPortrait,
  battleSingerStage,
  isBattleGroupOn,
} from 'lib/battleSingers'
import { useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import SpriteLoop from 'components/SpriteLoop/SpriteLoop'
import useBattleGroups from './useBattleGroups'
import styles from './BattleSingerSelect.css'

/**
 * Choosing who you sing as (Arcade Flow v2, 03): at sign-in, and again from
 * the Account page.
 *
 * One grid for both, because they are one decision made at two moments.
 * Building it twice is how the two end up a step apart the first time the
 * roster grows.
 *
 * Fighters come in groups — themes, on screen — one tab per group the room has
 * switched on, and the tab row is always drawn, even with the shipped group
 * alone. Pressing a tab selects that theme's first fighter, as the design's
 * picker does.
 *
 * The pick is shown large above the grid, singing on their own stage, so the
 * choice reads as a person rather than a thumbnail.
 */

interface BattleSingerSelectProps {
  selectedId: string
  onPick: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void
  onNext: (e: React.MouseEvent<HTMLButtonElement>) => void
}

/** A group folder as the design names it on the tab: `halloween` → `Halloween`. */
const label = (group: string) => group.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

/** A fighter with no stage of their own stands on the dive bar. Guarded so a
 *  missing plate cannot loop the error handler. */
const fallBackToPlate = (e: React.SyntheticEvent<HTMLImageElement>) => {
  if (!e.currentTarget.src.endsWith(BATTLE_STAGE_PLATE)) e.currentTarget.src = BATTLE_STAGE_PLATE
}

const BattleSingerSelect = ({ selectedId, onPick, onNext }: BattleSingerSelectProps) => {
  const prefs = useAppSelector(state => (state.user.roomId === null
    ? undefined
    : state.rooms.entities[state.user.roomId]?.prefs?.battle?.groups))
  const all = useBattleGroups()
  const on = all.filter(g => isBattleGroupOn(prefs, g.name))
  // a room that switched everything off still gets somebody to be
  const groups = on.length ? on : all.filter(g => g.name === DEFAULT_GROUP)

  // the listed fighter, so the name, height and sheets are the manifest's
  const picked = all.flatMap(g => g.singers).find(s => s.id === selectedId)
    ?? battleSingerOrDefault(selectedId)

  // the theme on show follows the pick until somebody chooses a tab
  const [tab, setTab] = useState<string | null>(null)
  const active = groups.find(g => g.name === (tab ?? picked.group))?.name ?? groups[0]?.name

  return (
    <div className={styles.body}>
      <h1 className={styles.title}>Select your singer</h1>

      <div className={styles.tabs} role='tablist'>
        {groups.map(group => (
          <button
            key={group.name}
            type='button'
            role='tab'
            aria-selected={group.name === active}
            className={clsx(styles.tab, group.name === active && styles.tabOn, group.name !== DEFAULT_GROUP && styles.alt)}
            onClick={(e) => {
              // the design's pick: a tab press also selects that theme's first fighter
              setTab(group.name)
              if (group.singers[0]) onPick(group.singers[0].id, e)
            }}
          >
            <span translate='no'>{`${label(group.name)} ${group.singers.length}`}</span>
          </button>
        ))}
      </div>

      <div className={clsx(styles.preview, active !== DEFAULT_GROUP && styles.alt)}>
        <img
          key={picked.id}
          className={styles.stage}
          src={battleSingerStage(picked)}
          alt=''
          onError={fallBackToPlate}
        />
        <SpriteLoop key={picked.id} singer={picked} loop='sing' size='330px' facing='left' className={styles.figure} />
        <span className={styles.badge}>P1</span>
      </div>

      <div className={styles.nameRow}>
        <span className={styles.name} translate='no'>{picked.name}</span>
        <span className={styles.theme} translate='no'>
          {[picked.height, label(active)].filter(Boolean).join(' · ')}
        </span>
      </div>

      {groups.map(group => (
        <div key={group.name} className={styles.grid} role='tabpanel' hidden={group.name !== active}>
          {group.singers.map((singer) => {
            const isSelected = singer.id === selectedId

            return (
              <button
                key={singer.id}
                type='button'
                aria-label={singer.name}
                aria-pressed={isSelected}
                title={singer.name}
                className={clsx(styles.tile, isSelected && styles.tileOn)}
                onClick={e => onPick(singer.id, e)}
              >
                <img className={styles.portrait} src={battleSingerPortrait(singer, 80)} alt='' loading='lazy' />
              </button>
            )
          })}
        </div>
      ))}

      {/* Never dead: the selection arrives seeded and cannot be cleared, so
          there is no state where this key is the thing stopping somebody. */}
      <div className={styles.spacer} />
      <div className={styles.footer}>
        <Button variant='primary' className={styles.select} onClick={onNext}>Select</Button>
      </div>
    </div>
  )
}

export default BattleSingerSelect
