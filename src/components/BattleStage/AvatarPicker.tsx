import React, { useState } from 'react'
import { battleSingerOrDefault } from 'lib/battleSingers'
import { updateAccount } from 'store/modules/user'
import { useAppDispatch } from 'store/hooks'
import BattleSingerSelect from './BattleSingerSelect'

/**
 * Choosing which fighter you are, as an account rather than as a battle.
 *
 * The grid itself is BattleSingerSelect, unchanged — it already knows about
 * groups, room prefs and the three-way selection affordance, and a second
 * nine-tile grid is how the two end up a step apart the first time the roster
 * grows. All this adds is the one thing a per-battle pick never needed: NEXT
 * writes the choice to the account.
 *
 * `takenId` is deliberately not passed. Nobody else's choice constrains yours
 * here: this is who you are, not who is free in one fight.
 */
interface AvatarPickerProps {
  /** Today's choice, if there is one. Absent at the sign-in gate, which is the
   *  whole reason that gate is up. */
  avatarId?: string | null
  /** Called after the account has been written, for a caller that has a screen
   *  to close. The gate has none — it stops rendering once the store carries
   *  an avatarId. */
  onDone?: () => void
}

const AvatarPicker = ({ avatarId, onDone }: AvatarPickerProps) => {
  const dispatch = useAppDispatch()
  // Seeded rather than empty, so NEXT is live on arrival: an unpicked grid
  // would make the key the thing standing between somebody and the app.
  const [selectedId, setSelectedId] = useState(() => battleSingerOrDefault(avatarId).id)

  const handleNext = () => {
    const data = new FormData()
    data.append('avatarId', selectedId)

    // isSilent: a stranger's first interaction with this app should not be a
    // browser dialog saying the account was updated successfully.
    void dispatch(updateAccount({ data, isSilent: true }))
    onDone?.()
  }

  return (
    <BattleSingerSelect
      selectedId={selectedId}
      lastId={avatarId ?? undefined}
      onPick={id => setSelectedId(id)}
      onNext={handleNext}
    />
  )
}

export default AvatarPicker
