import React from 'react'
import Accordion from 'components/Accordion/Accordion'
import Icon from 'components/Icon/Icon'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import useBattleGroups from 'components/BattleStage/useBattleGroups'
import { isBattleGroupOn } from 'lib/battleSingers'
import { BATTLE_JUDGING_DEFAULT, type IRoomPrefs } from 'shared/types'
import styles from './BattlePrefs.css'

interface BattlePrefsProps {
  prefs: Partial<IRoomPrefs>
  onChange: (prefs: Partial<IRoomPrefs>) => void
}

const BattlePrefs = ({ onChange, prefs = {} }: BattlePrefsProps) => {
  const isEnabled = prefs?.battle?.isEnabled ?? false
  const judging = prefs?.battle?.judging ?? BATTLE_JUDGING_DEFAULT
  const groups = useBattleGroups()

  const handleSetPref = (update: Partial<IRoomPrefs['battle']>) => {
    onChange({ ...prefs, battle: { ...prefs.battle, ...update } })
  }

  return (
    <Accordion
      headingComponent={(
        <div className={styles.heading}>
          <Icon icon='FLAG' />
          <div>Singer Battle</div>
        </div>
      )}
    >
      <div className={styles.content}>
        <div>
          <InputCheckbox
            label='Allow singer battles'
            checked={isEnabled}
            onChange={event => handleSetPref({ isEnabled: event.currentTarget.checked })}
          />
        </div>

        {/* Off until a host asks for it, rather than on until they object. A
            battle spends one queue row and five minutes of the room's evening
            on two people, and a room that gets one it did not ask for has lost
            a turn it cannot get back. */}
        <p className={styles.note}>
          One turn, two singers, one song each, and the room decides who won.
          Takes about five minutes and uses a single place in the queue.
        </p>
        {isEnabled && (
          <>
            <div>
              <InputCheckbox
                label='Judge singer battles by crowd noise'
                checked={judging === 'crowd'}
                onChange={event => handleSetPref({ judging: event.currentTarget.checked ? 'crowd' : 'ballot' })}
              />
            </div>

            {judging === 'crowd'
              ? (
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
                )
              : (
                  <p className={styles.note}>
                    Everyone in the room votes on their own phone, one vote each and the
                    two fighters sitting it out. Nobody sees the count — not the room, not
                    the TV — until the verdict.
                  </p>
                )}

            {/* One switch per folder under assets/battle/fighters. Adding a
                group is dropping a folder of fighters there; this is where a
                room opts in to it. */}
            {groups.map(group => (
              <div key={group.name}>
                <InputCheckbox
                  label={`Fighters: ${group.name.replace(/[-_]/g, ' ')} (${group.singers.length})`}
                  checked={isBattleGroupOn(prefs?.battle?.groups, group.name)}
                  onChange={event => handleSetPref({
                    groups: { ...prefs?.battle?.groups, [group.name]: event.currentTarget.checked },
                  })}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </Accordion>
  )
}

export default BattlePrefs
