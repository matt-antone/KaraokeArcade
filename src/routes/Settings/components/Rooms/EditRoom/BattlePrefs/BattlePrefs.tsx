import React from 'react'
import Accordion from 'components/Accordion/Accordion'
import Icon from 'components/Icon/Icon'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import InputRadio from 'components/InputRadio/InputRadio'
import { BATTLE_JUDGING_DEFAULT, type BattleJudgingPref, type IRoomPrefs } from 'shared/types'
import styles from './BattlePrefs.css'

interface BattlePrefsProps {
  prefs: Partial<IRoomPrefs>
  onChange: (prefs: Partial<IRoomPrefs>) => void
}

const BattlePrefs = ({ onChange, prefs = {} }: BattlePrefsProps) => {
  const isEnabled = prefs?.battle?.isEnabled ?? false
  const judging = prefs?.battle?.judging ?? BATTLE_JUDGING_DEFAULT

  const handleSetPref = (update: Partial<IRoomPrefs['battle']>) => {
    onChange({ ...prefs, battle: { ...prefs.battle, ...update } })
  }

  return (
    <Accordion
      headingComponent={(
        <div className={styles.heading}>
          <Icon icon='FLAG' />
          <div>Battle</div>
        </div>
      )}
    >
      <div className={styles.content}>
        <div>
          <InputCheckbox
            label='Allow song battles'
            checked={isEnabled}
            onChange={event => handleSetPref({ isEnabled: event.currentTarget.checked })}
          />
        </div>
        {isEnabled && (
          <>
            <div className={styles.field}>
              <label className={styles.groupLabel}>How a battle is decided</label>
              <InputRadio
                name='battle-judging'
                value='ballot'
                checked={judging === 'ballot'}
                onChange={value => handleSetPref({ judging: value as BattleJudgingPref })}
                label='Silent ballot on phones'
              />
              <InputRadio
                name='battle-judging'
                value='crowd'
                checked={judging === 'crowd'}
                onChange={value => handleSetPref({ judging: value as BattleJudgingPref })}
                label='Crowd noise through the microphone'
              />
            </div>

            {judging === 'ballot'
              ? (
                  <p className={styles.note}>
                    Everyone in the room votes on their own phone, one vote each and the
                    two fighters sitting it out. Nobody sees the count — not the room, not
                    the TV — until the verdict.
                  </p>
                )
              : (
                  // The one thing about battles an operator cannot work out from
                  // the screen. Crowd scoring is a getUserMedia call, and browsers
                  // only grant a microphone on a secure origin — localhost counts,
                  // a plain http:// LAN address does not. A player opened from
                  // another laptop or a phone therefore hears nothing, and rather
                  // than erroring the battle just ends level, which reads as a bug
                  // in the scoring. Said here in the room editor because this is
                  // where a host chooses it and forms an expectation about how
                  // battles end.
                  <p className={styles.note}>
                    Crowd scoring listens through the microphone of whichever machine has the
                    player window open, and browsers only allow that on a secure origin — in
                    practice, a player opened at http://localhost on the machine running the
                    server. A player opened at the LAN address cannot hear the room, so its
                    battles are decided as a draw instead.
                  </p>
                )}
          </>
        )}
      </div>
    </Accordion>
  )
}

export default BattlePrefs
