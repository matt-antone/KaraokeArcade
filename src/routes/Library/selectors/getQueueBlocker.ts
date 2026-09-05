import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from 'store/store'

/**
 * Why this device cannot queue a song right now, or null when it can.
 *
 * The library used to offer all three hundred songs whatever the state of the
 * room, and the answer came back after the tap: an admin signed in without a
 * room got a refusal on every song, and a room paused mid-night went on taking
 * requests it would not honour. The same two facts the server checks in
 * Rooms.validate are already on the client, so the rows can say so before they
 * are pressed rather than after.
 *
 * Deliberately permissive when it does not know. myRoomStatus is null until
 * the server pushes it — on connect and on every transport change — and a
 * library greyed out on missing data is a worse bug than the one this fixes.
 *
 * The string is what the library prints, so it reads as a sentence rather than
 * a state name.
 */
const getRoomId = (state: RootState) => state.user.roomId
const getMyRoomStatus = (state: RootState) => state.rooms.myRoomStatus

const getQueueBlocker = createSelector(
  [getRoomId, getMyRoomStatus],
  (roomId, status): string | null => {
    if (typeof roomId !== 'number') return 'You\'re not in a room'
    if (status === 'paused') return 'This room is paused'
    if (status === 'stopped') return 'This room is closed'

    return null
  },
)

export default getQueueBlocker
