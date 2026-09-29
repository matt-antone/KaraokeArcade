import React, { useState } from 'react'
import clsx from 'clsx'
import {
  BATTLE_STAGE_PLATE,
  DEFAULT_GROUP,
  battleSingerFrontArt,
  battleSingerOrDefault,
  battleSingerPortrait,
  battleSingerStage,
  isBattleGroupOn,
} from 'lib/battleSingers'
import { useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import useBattleGroups from './useBattleGroups'
import styles from './BattleSingerSelect.css'

/**
 * Choosing who you sing as: at sign-in, and again from the Account page.
 *
 * One grid for both, because they are one decision made at two moments.
 * Building it twice is how the two end up a step apart the first time the
 * roster grows.
 *
 * Fighters come in groups — themes, on screen — one tab per group the room has
 * switched on. With only the shipped group on there is nothing to switch
 * between, so there are no tabs. Every group's grid is in the page and the
 * inactive ones hidden, so a pick made on one theme survives looking at
 * another.
 *
 * The pick is shown large above the grid, standing on their own stage, so the
 * choice reads as a person rather than a thumbnail.
 */

interface BattleSingerSelectProps {
  selectedId: string
  /** Who this phone sang as last time, tagged so a regular can find them
   *  without reading nine names. Not drawn on the tile that is already
   *  selected, where it would be saying the same thing twice. */
  lastId?: string
  onPick: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void
  onNext: (e: React.MouseEvent<HTMLButtonElement>) => void
}

const label = (group: string) => group.replace(/[-_]/g, ' ')

/** A fighter with no stage of their own stands on the dive bar. Guarded so a
 *  missing plate cannot loop the error handler. */
const fallBackToPlate = (e: React.SyntheticEvent<HTMLImageElement>) => {
  if (!e.currentTarget.src.endsWith(BATTLE_STAGE_PLATE)) e.currentTarget.src = BATTLE_STAGE_PLATE
}

const BattleSingerSelect = ({
  selectedId, lastId, onPick, onNext,
}: BattleSingerSelectProps) => {
  const picked = battleSingerOrDefault(selectedId)
  const prefs = useAppSelector(state => (state.user.roomId === null
    ? undefined
    : state.rooms.entities[state.user.roomId]?.prefs?.battle?.groups))
  const all = useBattleGroups()
  const on = all.filter(g => isBattleGroupOn(prefs, g.name))
  // a room that switched everything off still gets somebody to be
  const groups = on.length ? on : all.filter(g => g.name === DEFAULT_GROUP)

  // the theme on show follows the pick until somebody chooses a tab
  const [tab, setTab] = useState<string | null>(null)
  const active = groups.find(g => g.name === (tab ?? picked.group))?.name ?? groups[0]?.name

  return (
    <div className={styles.body}>
      <h1 className={styles.title}>Select your singer</h1>
      <p className={styles.lede}>THIS IS WHO SINGS FOR YOU TONIGHT</p>

      {groups.length > 1 && (
        <div className={styles.tabs} role='tablist'>
          {groups.map(group => (
            <button
              key={group.name}
              type='button'
              role='tab'
              aria-selected={group.name === active}
              className={clsx(styles.tab, group.name === active && styles.tabOn, group.name !== DEFAULT_GROUP && styles.alt)}
              onClick={() => setTab(group.name)}
            >
              <span translate='no'>{label(group.name)}</span>
              {' '}
              {group.singers.length}
            </button>
          ))}
        </div>
      )}

      <div className={clsx(styles.preview, active !== DEFAULT_GROUP && styles.alt)}>
        <img
          key={picked.id}
          className={styles.stage}
          src={battleSingerStage(picked)}
          alt=''
          onError={fallBackToPlate}
        />
        <img className={styles.figure} src={battleSingerFrontArt(picked).url} alt='' />
        <span className={styles.badge}>P1</span>
      </div>

      <div className={styles.nameRow}>
        <span className={styles.name} translate='no'>{picked.name}</span>
        <span className={styles.theme} translate='no'>{label(picked.group)}</span>
      </div>

      {groups.map(group => (
        <div key={group.name} className={styles.grid} role={groups.length > 1 ? 'tabpanel' : undefined} hidden={group.name !== active}>
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
                {!isSelected && singer.id === lastId && <span className={styles.tag}>LAST</span>}
              </button>
            )
          })}
        </div>
      ))}

      {/* Never dead: the selection arrives seeded and cannot be cleared, so
          there is no state where this key is the thing stopping somebody. */}
      <div className={styles.footer}>
        <Button variant='primary' className={styles.select} onClick={onNext}>Select</Button>
      </div>
    </div>
  )
}

export default BattleSingerSelect
