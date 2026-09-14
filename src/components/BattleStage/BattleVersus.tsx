import React from 'react'
import clsx from 'clsx'
import BattleKey from './BattleKey'
import styles from './BattleVersus.css'

/**
 * The pairing, on both confirm screens.
 *
 * Two plates and the word between them, then who is inside each plate written
 * out underneath. The plates hold whatever the screen has of a person — a
 * fighter on the side that has picked one, a photograph on the side that has
 * not yet — so this component takes nodes rather than art, and the ring, the
 * label and the handle are the parts that have to agree about which side is
 * which.
 *
 * `tint` is the side, never the phone: the challenger is red and the opponent
 * is green on both screens, so the two people looking at their own phones are
 * looking at the same fight rather than at mirror images of it.
 */

/* The ring belongs to a plate and the ink to a label, and they are separate
   maps because a class carrying both puts a hard ring around a word. */
const RING = { one: styles.ringOne, two: styles.ringTwo }
const TINT = { one: styles.tintOne, two: styles.tintTwo, gold: styles.tintGold }

interface BattleVersusSide {
  /** YOU, OPPONENT, CHALLENGER. */
  label: string
  handle: string
  tint: 'one' | 'two'
  plate: React.ReactNode
}

interface BattleVersusProps {
  /** Always the left plate, always flipped to face the other one. */
  you: BattleVersusSide
  them: BattleVersusSide
  /** The left plate is where the flying singer lands on the confirm step. */
  youRef?: React.RefObject<HTMLDivElement | null>
}

const BattleVersus = ({ you, them, youRef }: BattleVersusProps) => (
  <>
    <div className={styles.pairing}>
      <div className={clsx(styles.plate, RING[you.tint])} ref={youRef}>{you.plate}</div>
      <div className={styles.vs}>VS</div>
      <div className={clsx(styles.plate, RING[them.tint])}>{them.plate}</div>
    </div>

    <div className={styles.handles}>
      {[you, them].map(side => (
        <div className={styles.handlePlate} key={side.label}>
          <div className={clsx(styles.handleLabel, TINT[side.tint])}>{side.label}</div>
          <div className={styles.handle} translate='no'>{side.handle}</div>
        </div>
      ))}
    </div>
  </>
)

interface BattleSummaryRow {
  label: string
  value: string
  tint?: 'gold' | 'one' | 'two'
  /** Present on the rows that are still somebody's to change. Jumps straight
   *  back to the step that owns it rather than walking back through the
   *  flow. */
  onEdit?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

/** What is about to be agreed, as a list. Hairlines are the gap over a ground,
 *  not a border on each row, so the rule between two rows cannot double up. */
export const BattleSummary = ({ rows, isWide }: { rows: BattleSummaryRow[], isWide?: boolean }) => (
  <div className={styles.summary}>
    {rows.map(row => (
      <div className={styles.row} key={row.label}>
        <div className={clsx(styles.rowLabel, isWide && styles.rowLabelWide)}>{row.label}</div>
        <div className={clsx(styles.rowValue, row.tint && TINT[row.tint])} translate='no'>{row.value}</div>
        {row.onEdit && <BattleKey variant='link' onClick={row.onEdit}>EDIT</BattleKey>}
      </div>
    ))}
  </div>
)

export default BattleVersus
