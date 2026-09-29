import React, { useState } from 'react'
import { battleSingerOrDefault } from 'lib/battleSingers'
import { updateAccount } from 'store/modules/user'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Hud from 'components/Header/Hud/Hud'
import ScoringTutorial from 'components/ScoringTutorial/ScoringTutorial'
import { hasSeenScoring, markScoringSeen } from 'components/ScoringTutorial/scoringSeen'
import BattleSingerSelect from './BattleSingerSelect'
import styles from './AvatarPicker.css'

/**
 * Choosing which fighter you are, as an account rather than as a battle.
 *
 * The grid itself is BattleSingerSelect, unchanged — it already knows about
 * groups, room prefs and the selected preview, and a second
 * nine-tile grid is how the two end up a step apart the first time the roster
 * grows. All this adds is a selection that starts somewhere sensible and a
 * key that reports what it landed on.
 */
interface AvatarPickerProps {
  /** Today's choice, if there is one. Absent at the sign-in gate, which is the
   *  whole reason that gate is up. */
  avatarId?: string | null
  onChoose: (avatarId: string) => void
}

const AvatarPicker = ({ avatarId, onChoose }: AvatarPickerProps) => {
  // Seeded rather than empty, so the key is live on arrival: an unpicked grid
  // would make the key the thing standing between somebody and the app.
  const [selectedId, setSelectedId] = useState(() => battleSingerOrDefault(avatarId).id)

  return (
    <BattleSingerSelect
      selectedId={selectedId}
      lastId={avatarId ?? undefined}
      onPick={id => setSelectedId(id)}
      onNext={() => onChoose(selectedId)}
    />
  )
}

export default AvatarPicker

/**
 * The picker as the sign-in gate stands it up: the same grid, writing straight
 * to the account.
 *
 * Its own component rather than a branch inside the route table, because what
 * happens when somebody presses Select is a store concern and RequireAuth is a
 * routing one. There is nothing to close afterwards — the gate stops rendering
 * the moment the store carries an avatarId.
 */
export const AvatarGate = () => {
  const dispatch = useAppDispatch()
  const avatarId = useAppSelector(state => state.user.avatarId)
  const userId = useAppSelector(state => state.user.userId)
  const room = useAppSelector(state => (state.user.roomId === null
    ? undefined
    : state.rooms.entities[state.user.roomId]?.name))
  // held while the scoring tutorial is up, then written on Continue
  const [pending, setPending] = useState<string | null>(null)

  const save = (chosen: string) => {
    const data = new FormData()
    data.append('avatarId', chosen)

    // isSilent: a stranger's first interaction with this app should not be a
    // browser dialog telling them the account was updated successfully.
    void dispatch(updateAccount({ data, isSilent: true }))
  }

  // A first pick goes by way of how scoring works, once per account on this
  // phone. The write waits for Continue because the gate stops rendering the
  // moment the store carries an avatarId, and the tutorial with it.
  const handleChoose = (chosen: string) => {
    if (hasSeenScoring(userId)) save(chosen)
    else setPending(chosen)
  }

  const handleContinue = () => {
    markScoringSeen(userId)
    if (pending) save(pending)
  }

  // The cabinet's own full-screen shell, lifted over everything else fixed on
  // the page (the bottom chrome at 99, battle screens at 100): nothing in the
  // app may sit on top of the one question it is waiting on.
  return (
    <div className={styles.gate}>
      <Hud room={room} />
      {pending
        ? <ScoringTutorial singer={battleSingerOrDefault(pending)} onContinue={handleContinue} />
        : <AvatarPicker avatarId={avatarId} onChoose={handleChoose} />}
    </div>
  )
}
