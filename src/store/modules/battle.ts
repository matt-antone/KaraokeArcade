import { createAction, createReducer } from '@reduxjs/toolkit'
import type { RootState } from 'store/store'
import type {
  BattleInvite,
  BattleSide,
  BattleSinger,
  BattleTurn,
  BattleTurnRequestStatus,
} from 'shared/types'
import {
  BATTLE_ACCEPT,
  BATTLE_CANCEL,
  BATTLE_CHALLENGE,
  BATTLE_DECLINE,
  BATTLE_INVITE,
  BATTLE_INVITE_CLEAR,
  BATTLE_PICK,
  BATTLE_PICK_MODE_EXIT,
  BATTLE_REQ_SINGERS,
  BATTLE_REQ_TURN,
  BATTLE_SCORE,
  BATTLE_SINGERS,
  BATTLE_SONG_ENDED,
  BATTLE_TURN,
  BATTLE_TURN_CLEAR,
  BATTLE_VOTE,
  LOGOUT,
  _SUCCESS,
} from 'shared/actionTypes'

/**
 * Choosing who to fight never leaves this device, so it has no counterpart in
 * shared/actionTypes: the server learns about it only when the challenger has
 * also chosen a song and BATTLE_CHALLENGE goes out. Its opposite number,
 * BATTLE_PICK_MODE_EXIT, *is* shared only because the same escape hatch has to
 * clear an accepted invite the server does know about.
 */
const BATTLE_PICK_MODE_ENTER = 'battle/PICK_MODE_ENTER'

// ------------------------------------
// Actions
// ------------------------------------
const logout = createAction(LOGOUT)
const battleSingers = createAction<BattleSinger[]>(BATTLE_SINGERS)
const battleInvite = createAction<BattleInvite>(BATTLE_INVITE)
const battleInviteClear = createAction(BATTLE_INVITE_CLEAR)
const battleTurn = createAction<BattleTurn>(BATTLE_TURN)
const battleTurnClear = createAction(BATTLE_TURN_CLEAR)
const battleTurnRequested = createAction<{ queueId: number, status: BattleTurnRequestStatus }>(BATTLE_REQ_TURN + _SUCCESS)

/**
 * These four are `server/` actions, which the socket middleware emits *and*
 * passes on to the reducer. That is what lets the reducer below answer a tap
 * before the round trip does — see the notes on each case.
 */
const battleChallenge = createAction<{ opponentUserId: number, songId: number, queueId: number }>(BATTLE_CHALLENGE)
const battleDecline = createAction(BATTLE_DECLINE)
const battleCancel = createAction(BATTLE_CANCEL)
const battlePickModeEnter = createAction<BattleSinger>(BATTLE_PICK_MODE_ENTER)
const battlePickModeExit = createAction(BATTLE_PICK_MODE_EXIT)
const battleVote = createAction<{ queueId: number, side: BattleSide }>(BATTLE_VOTE)

/** Ask the server who else is in the room and could be fought. Answered to
 *  this socket alone, so the list is never stale for somebody else. */
export function requestBattleSingers () {
  return { type: BATTLE_REQ_SINGERS }
}

/** The challenger has chosen an opponent but not yet a song for them. Nothing
 *  goes to the server yet: until a song is picked there is no challenge to
 *  throw, and telling the room about a half-formed one would let a wandering
 *  thumb pin somebody in a dialog they cannot answer. */
export function startBattlePick (singer: BattleSinger) {
  return battlePickModeEnter(singer)
}

/** Back out of the library's picking mode, from either side of the
 *  negotiation. Shared with the server because the opponent may already have
 *  accepted, and an accepted invite the server still holds would keep the
 *  challenger waiting for a song that is never coming. */
export function exitBattlePick () {
  return battlePickModeExit()
}

/** Throw the challenge. `queueId` is the challenger's next upcoming song row —
 *  the turn they are spending on this — or 0 if they have none, in which case
 *  the server appends a fresh row at the tail. */
export function challengeSinger (opponentUserId: number, songId: number, queueId: number) {
  return battleChallenge({ opponentUserId, songId, queueId })
}

export function acceptBattle () {
  return { type: BATTLE_ACCEPT }
}

export function declineBattle () {
  return battleDecline()
}

/** The opponent's half of the deal: the song the challenger will have to sing.
 *  The server now holds both songs and converts the queue row. */
export function pickBattleSong (songId: number) {
  return { type: BATTLE_PICK, payload: { songId } }
}

export function cancelBattle () {
  return battleCancel()
}

/** Ask the server to run this row's battle. Only the player sends this, on
 *  reaching the row, and it reports whether it can hear the room. That only
 *  matters to a room set to crowd scoring: a player opened at a LAN address
 *  has no microphone on the crowd, so the two metering beats would sit there
 *  in silence and the verdict would be noise. The room decides the rest. */
export function requestBattleTurn (queueId: number, canHearRoom: boolean) {
  return { type: BATTLE_REQ_TURN, payload: { queueId, canHearRoom } }
}

/** This phone's vote, during the ballot beat. Applied locally on the tap as
 *  well as sent: the ballot is silent, so the server says nothing back, and
 *  the only confirmation the voter gets is their own key lighting up. */
export function castBattleVote (queueId: number, side: BattleSide) {
  return battleVote({ queueId, side })
}

/** The song ran out before its two-minute cut. Ends that singing beat early
 *  rather than leaving the room staring at a finished song. */
export function battleSongEnded (queueId: number, side: BattleSide) {
  return { type: BATTLE_SONG_ENDED, payload: { queueId, side } }
}

/** What the room gave that fighter, out of BATTLE_SCORE_MAX. Sent by the
 *  player at the end of a metering beat; the server clamps it again on
 *  arrival, because this number is measured from a microphone and a microphone
 *  is the least trustworthy input in the building. */
export function reportBattleScore (queueId: number, side: BattleSide, score: number) {
  return { type: BATTLE_SCORE, payload: { queueId, side, score } }
}

// ------------------------------------
// Reducer
// ------------------------------------
interface BattleState {
  /** Everyone else in the room, as of the last time this device asked. */
  singers: BattleSinger[]
  /** The opponent this device has chosen but not yet challenged. Local only,
   *  and the first of the two things that put the library into picking mode. */
  pending: BattleSinger | null
  /** The challenge in flight, as both parties see it. Null when there is none. */
  invite: BattleInvite | null
  /** The beat on stage right now. One of these per beat, not one per battle. */
  turn: BattleTurn | null
  /** This phone's vote in the battle on stage, and the row it was cast in.
   *  Local only: nobody is told who voted for whom, and the tally reaches this
   *  phone the same way it reaches the room, on the verdict beat. */
  vote: { queueId: number, side: BattleSide } | null
  /** A battle row the server has finished with, or declined to run at all. The
   *  player waits for this before advancing, so it neither skips a battle that
   *  is about to start nor sits for ever on one that is not coming. -1 rather
   *  than 0 because 0 is a queueId the wire uses for "none", and a real row is
   *  never -1. */
  resolvedQueueId: number
}

const initialState: BattleState = {
  singers: [],
  pending: null,
  invite: null,
  turn: null,
  vote: null,
  resolvedQueueId: -1,
}

const battleReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(battleSingers, (state, { payload }) => {
      state.singers = payload
    })
    .addCase(battlePickModeEnter, (state, { payload }) => {
      state.pending = payload
    })
    .addCase(battlePickModeExit, (state) => {
      state.pending = null
      state.invite = null
    })
    .addCase(battleChallenge, (state) => {
      // Cleared on the way out rather than on the way back. The library is in
      // picking mode *because* pending is set, so leaving it set through the
      // round trip means the next tap picks a second song and throws a second
      // challenge at the same person.
      state.pending = null
    })
    .addCase(battleInvite, (state, { payload }) => {
      state.invite = payload
      // Belt and braces: the challenger's own pending is already gone, but the
      // opponent may have been mid-pick against somebody else when this landed
      // and two pick modes at once has no honest answer.
      state.pending = null
    })
    .addCase(battleInviteClear, (state) => {
      state.invite = null
      state.pending = null
    })
    .addCase(battleDecline, (state) => {
      // Applied locally so the modal goes away on the tap. The server's
      // BATTLE_INVITE_CLEAR follows and lands on an already-empty state.
      state.invite = null
      state.pending = null
    })
    .addCase(battleCancel, (state) => {
      state.invite = null
      state.pending = null
    })
    // Accepting is deliberately NOT applied locally, unlike declining. Accept
    // sends this phone into the library to pick, and if the challenger cancels
    // in the same instant the phone is stranded in a picking mode for an
    // invite that no longer exists. Declining can only ever end in nothing, so
    // it is safe to assume; accepting cannot, so it waits for the server's
    // BATTLE_INVITE with isAccepted set.
    .addCase(battleVote, (state, { payload }) => {
      state.vote = payload
    })
    .addCase(battleTurn, (state, { payload }) => {
      state.turn = payload
      // A beat for another row means the fight this phone voted in is over.
      // Cleared here rather than only on TURN_CLEAR because two battles can
      // run back to back with no idle beat between them, and a stale vote
      // would show the next room's ballot already answered.
      if (state.vote && state.vote.queueId !== payload.queueId) state.vote = null
    })
    .addCase(battleTurnClear, (state) => {
      state.turn = null
      state.vote = null
    })
    .addCase(battleTurnRequested, (state, { payload }) => {
      // Only "there is nothing to run here" frees the player. 'inProgress'
      // means this row's battle is already under way — which is exactly what a
      // duplicate request under React's double-invoked effects looks like —
      // and must leave the player waiting.
      if (payload.status === 'unavailable') state.resolvedQueueId = payload.queueId
    })
    .addCase(logout, () => initialState)
})

/**
 * Who this device is picking a song for, or null when it is just browsing.
 *
 * The one question the library asks. Both sides of a battle pick a song from
 * the same screen, at different moments and for different people, and this
 * collapses that into a single answer so the library needs no idea how a
 * negotiation works:
 *
 *  - the challenger has chosen an opponent and is choosing their song
 *  - the opponent has accepted and is choosing the challenger's song
 *
 * The second arm checks the invite is accepted *and* that we are its opponent.
 * Both parties hold the same invite object — the server emits it to both
 * sockets — so without the userId check the challenger's phone would also
 * enter picking mode the moment their challenge was accepted, and the pick it
 * sent would be read as the opponent's.
 */
export const getBattlePick = (state: RootState): { forUserId: number, forName: string } | null => {
  const { pending, invite } = state.battle

  if (pending) return { forUserId: pending.userId, forName: pending.name }

  if (invite && invite.isAccepted && invite.opponentUserId === state.user.userId) {
    return { forUserId: invite.challengerUserId, forName: invite.challengerName }
  }

  return null
}

export default battleReducer
