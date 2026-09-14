import React from 'react'
import clsx from 'clsx'
import { BATTLE_SINGERS, battleSingerKeyArt, battleSingerOrDefault } from 'lib/battleSingers'
import BattleKey from './BattleKey'
import BattleSprite from './BattleSprite'
import styles from './BattleSingerSelect.css'

/**
 * Choosing who you sing as. The same screen on both phones.
 *
 * The two sides differ by one tile and one colour, neither of which is worth a
 * second copy of a nine-tile grid: the tint comes from `--arc-mine` on the
 * frame, and the tag on a tile is a prop. Building it twice is how the
 * opponent's grid ends up a step behind the challenger's the first time the
 * roster grows.
 *
 * The grid is built from BATTLE_SINGERS rather than from the two fighters that
 * happen to be drawn, so a slot lights up the moment its art lands and nothing
 * here has to be touched.
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
  /** Spoken for by the other side. The tile stays visible and drops to a third
   *  of its ink rather than disappearing: a roster that changes length
   *  between the two phones is a roster nobody can talk about out loud. */
  takenId?: string
  /** The footer chip, which is where the flying singer lands on the way in and
   *  takes off from on the way out. */
  slotRef?: React.RefObject<HTMLDivElement | null>
  /** True while the flyer is in the air and the chip must be empty, or the
   *  same sprite is drawn twice in two places. */
  isSlotHidden?: boolean
  onPick: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void
  onNext: (e: React.MouseEvent<HTMLButtonElement>) => void
}

const CORNERS = ['cornerTL', 'cornerTR', 'cornerBL', 'cornerBR'] as const

const BattleSingerSelect = ({
  selectedId, lastId, takenId, slotRef, isSlotHidden, onPick, onNext,
}: BattleSingerSelectProps) => {
  const picked = battleSingerOrDefault(selectedId)
  const pickedArt = battleSingerKeyArt(picked)

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
          {BATTLE_SINGERS.length}
          {' '}
          SINGERS
        </div>
      </div>

      <div className={styles.scroller}>
        <div className={styles.grid}>
          {BATTLE_SINGERS.map((singer) => {
            const art = battleSingerKeyArt(singer)
            const isSelected = singer.id === selectedId
            const isTaken = singer.id === takenId
            const isOff = !!singer.pending || isTaken

            return (
              <button
                key={singer.id}
                type='button'
                disabled={isOff}
                className={clsx(
                  styles.tile,
                  isSelected && styles.tileOn,
                  singer.pending && styles.tilePending,
                )}
                onClick={e => onPick(singer.id, e)}
              >
                <span className={styles.art}>
                  <BattleSprite art={art} className={clsx(styles.tileArt, isTaken && styles.tileArtTaken)} />
                  {!art && <span className={styles.locked}>?</span>}
                </span>

                <span className={styles.name} translate='no'>{singer.name}</span>

                {isSelected && (
                  <span className={styles.cursor}>
                    {CORNERS.map(corner => <span key={corner} className={styles[corner]} />)}
                  </span>
                )}

                {isTaken && <span className={styles.tag}>TAKEN</span>}
                {!isSelected && !isTaken && singer.id === lastId && <span className={styles.tag}>LAST</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.chipRow}>
          <div className={styles.chip} ref={slotRef}>
            {!isSlotHidden && <BattleSprite art={pickedArt} />}
          </div>
          <div className={styles.chipText}>
            <div className={styles.chipLegend}>SINGS FOR YOU</div>
            <div className={styles.chipName} translate='no'>{picked.name}</div>
          </div>
        </div>

        {/* Never dead: the selection arrives as the last singer used and cannot
            be cleared, so there is no state where this key is the thing
            stopping somebody. */}
        <BattleKey className={styles.next} onClick={onNext}>NEXT</BattleKey>
      </div>
    </div>
  )
}

export default BattleSingerSelect
