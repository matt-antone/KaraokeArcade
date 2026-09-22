import React, { useState } from 'react'
import { battleSingerOrDefault } from 'lib/battleSingers'
import { updateAccount } from 'store/modules/user'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import BattleSingerSelect from './BattleSingerSelect'

/**
 * Choosing which fighter you are, as an account rather than as a battle.
 *
 * The grid itself is BattleSingerSelect, unchanged — it already knows about
 * groups, room prefs and the three-way selection affordance, and a second
 * nine-tile grid is how the two end up a step apart the first time the roster
 * grows. All this adds is a selection that starts somewhere sensible and a
 * NEXT that reports what it landed on.
 */
interface AvatarPickerProps {
  /** Today's choice, if there is one. Absent at the sign-in gate, which is the
   *  whole reason that gate is up. */
  avatarId?: string | null
  onChoose: (avatarId: string) => void
}

const AvatarPicker = ({ avatarId, onChoose }: AvatarPickerProps) => {
  // Seeded rather than empty, so NEXT is live on arrival: an unpicked grid
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
 * happens when somebody presses NEXT is a store concern and RequireAuth is a
 * routing one. There is nothing to close afterwards — the gate stops rendering
 * the moment the store carries an avatarId.
 */
export const AvatarGate = () => {
  const dispatch = useAppDispatch()
  const avatarId = useAppSelector(state => state.user.avatarId)

  const handleChoose = (chosen: string) => {
    const data = new FormData()
    data.append('avatarId', chosen)

    // isSilent: a stranger's first interaction with this app should not be a
    // browser dialog telling them the account was updated successfully.
    void dispatch(updateAccount({ data, isSilent: true }))
  }

  return <AvatarPicker avatarId={avatarId} onChoose={handleChoose} />
}
