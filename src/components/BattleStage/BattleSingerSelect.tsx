import React from 'react'
import clsx from 'clsx'
import { DEFAULT_GROUP, battleSingerOrDefault, battleSingerPortrait, isBattleGroupOn } from 'lib/battleSingers'
import { useAppSelector } from 'store/hooks'
import BattleKey from './BattleKey'
import useBattleGroups from './useBattleGroups'
import styles from './BattleSingerSelect.css'

/**
 * Choosing who you sing as: at sign-in, and again from the Account page.
 *
 * One grid for both, because they are one decision made at two moments.
 * Building it twice is how the two end up a step apart the first time the
 * roster grows.
 *
 * Fighters come in groups — one boxed grid of head portraits per group the
 * room has switched on. The shipped group's box is untitled because it is the
 * roster; any other group is an addition and is named on its box, so a room
 * that switched on HALLOWEEN can see where the costumes start.
 *
 * Selection reads three ways at once — ring, name plate, blinking bracket —
 * because this is a dark room and a phone at arm's length, and any one of the
 * three alone is a coin toss about which tile is lit.
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

const CORNERS = ['cornerTL', 'cornerTR', 'cornerBL', 'cornerBR'] as const

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
  const count = groups.reduce((n, g) => n + g.singers.length, 0)

  return (
    <div className={styles.body}>
      <div className={styles.masthead}>
        <div className={styles.title}>
          PICK A
          <br />
          SINGER
        </div>
        <div className={styles.lede}>
          THIS IS WHO SINGS FOR YOU TONIGHT &middot;
          {' '}
          {count}
          {' '}
          SINGERS
        </div>
      </div>

      <div className={styles.scroller}>
        {groups.map(group => (
          <fieldset key={group.name} className={styles.box}>
            {group.name !== DEFAULT_GROUP && (
              <legend className={styles.legend} translate='no'>{group.name.replace(/[-_]/g, ' ')}</legend>
            )}

            <div className={styles.grid}>
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
                    <img className={styles.portrait} src={battleSingerPortrait(singer)} alt='' loading='lazy' />

                    {isSelected && (
                      <span className={styles.cursor}>
                        {CORNERS.map(corner => <span key={corner} className={styles[corner]} />)}
                      </span>
                    )}

                    {!isSelected && singer.id === lastId && <span className={styles.tag}>LAST</span>}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.chipRow}>
          <div className={styles.chip}>
            <img className={styles.chipPortrait} src={battleSingerPortrait(picked)} alt='' />
          </div>
          <div className={styles.chipText}>
            <div className={styles.chipLegend}>SINGS FOR YOU</div>
            <div className={styles.chipName} translate='no'>{picked.name}</div>
          </div>
        </div>

        {/* Never dead: the selection arrives seeded and cannot be cleared, so
            there is no state where this key is the thing stopping somebody. */}
        <BattleKey className={styles.next} onClick={onNext}>NEXT</BattleKey>
      </div>
    </div>
  )
}

export default BattleSingerSelect
