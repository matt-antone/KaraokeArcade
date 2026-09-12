import { describe, expect, it } from 'vitest'
import type { UnknownAction } from '@reduxjs/toolkit'
import { battleInvite, battleSinger, battleTurn } from 'lib/battleFixtures'
import type { RootState } from 'store/store'
import {
  BATTLE_INVITE,
  BATTLE_INVITE_CLEAR,
  BATTLE_REQ_TURN,
  BATTLE_SINGERS,
  BATTLE_TURN,
  BATTLE_TURN_CLEAR,
  LOGOUT,
  _SUCCESS,
} from 'shared/actionTypes'
import battleReducer, {
  acceptBattle,
  cancelBattle,
  challengeSinger,
  declineBattle,
  exitBattlePick,
  getBattlePick,
  startBattlePick,
} from './battle'

/**
 * A battle is negotiated across two phones and a server, in four round trips,
 * and the only thing either phone uses to decide "am I choosing a song for
 * somebody right now" is getBattlePick. Get that one answer wrong at any step
 * and a phone is stranded: either stuck in a library it cannot leave, or
 * staring at a browse screen while the room waits for it to pick.
 *
 * So this drives the real reducer through the whole negotiation in order and
 * asks getBattlePick at every step — from BOTH devices, since they run the
 * same reducer over the same server payloads and are told apart only by
 * state.user.userId. The invite object in particular is emitted identically to
 * both sockets, which is exactly the trap.
 */
const CHALLENGER = 1
const OPPONENT = 2

/** The reducer under test, as a device with a given signed-in user sees it. */
const run = (userId: number, actions: UnknownAction[]) => {
  const battle = actions.reduce(battleReducer, battleReducer(undefined, { type: '@@INIT' }))
  return { battle, user: { userId } } as RootState
}

const pick = (userId: number, actions: UnknownAction[]) => getBattlePick(run(userId, actions))

// what the server emits to both parties once a challenge is thrown
const invited = { type: BATTLE_INVITE, payload: battleInvite() }
const accepted = { type: BATTLE_INVITE, payload: battleInvite({ isAccepted: true }) }
const cleared = { type: BATTLE_INVITE_CLEAR }

const barf = battleSinger({ userId: OPPONENT, name: 'Barf' })
const singersArrive = { type: BATTLE_SINGERS, payload: [barf] }
const challenge = challengeSinger(OPPONENT, 11, 7) as UnknownAction

describe('battle reducer', () => {
  it('starts with nothing on stage and no row resolved', () => {
    const { battle } = run(CHALLENGER, [])

    expect(battle).toEqual({
      singers: [],
      pending: null,
      vote: null,
      invite: null,
      turn: null,
      // -1, not 0: 0 is a real "no queue row" on the wire and would read as a
      // resolved row the moment the player mounted
      resolvedQueueId: -1,
    })
  })

  it('holds the singers the server offered', () => {
    expect(run(CHALLENGER, [singersArrive]).battle.singers).toEqual([barf])
  })
})

describe('battle negotiation, as the challenger sees it', () => {
  it('is not picking for anyone before an opponent is chosen', () => {
    expect(pick(CHALLENGER, [singersArrive])).toBeNull()
  })

  it('picks for the chosen opponent, before the server knows anything', () => {
    expect(pick(CHALLENGER, [singersArrive, startBattlePick(barf)]))
      .toEqual({ forUserId: OPPONENT, forName: 'Barf' })
  })

  it('stops picking the instant the challenge is thrown', () => {
    // not when the server answers: the library is in picking mode *because*
    // pending is set, so a slow round trip is a window in which a second tap
    // throws a second challenge at the same person
    expect(pick(CHALLENGER, [startBattlePick(barf), challenge])).toBeNull()
  })

  it('is still not picking once the opponent accepts', () => {
    // the challenger's song is the opponent's to choose; both phones hold this
    // same accepted invite and only one of them may act on it
    expect(pick(CHALLENGER, [startBattlePick(barf), challenge, invited, accepted])).toBeNull()
  })

  it('drops the invite when the challenger backs out', () => {
    const { battle } = run(CHALLENGER, [startBattlePick(barf), challenge, invited, cancelBattle()])
    expect(battle.invite).toBeNull()
    expect(battle.pending).toBeNull()
  })
})

describe('battle negotiation, as the opponent sees it', () => {
  it('is not picking while the invite is still a question', () => {
    // the modal is up and the answer is not in yet; sending them to the
    // library here would answer it for them
    expect(pick(OPPONENT, [invited])).toBeNull()
  })

  it('picks for the challenger once accepted', () => {
    expect(pick(OPPONENT, [invited, accepted]))
      .toEqual({ forUserId: CHALLENGER, forName: 'Dot Matrix' })
  })

  it('does not enter picking mode on the tap alone', () => {
    // accepting is not applied locally, unlike declining: if the challenger
    // cancelled in the same instant, this phone would be picking a song for an
    // invite that no longer exists
    expect(pick(OPPONENT, [invited, acceptBattle() as UnknownAction])).toBeNull()
  })

  it('closes the modal on decline without waiting for the server', () => {
    expect(run(OPPONENT, [invited, declineBattle()]).battle.invite).toBeNull()
  })

  it('stops picking when the server clears the invite', () => {
    // this is the happy ending: BATTLE_PICK landed, the row was converted, and
    // both phones are released
    expect(pick(OPPONENT, [invited, accepted, cleared])).toBeNull()
    expect(pick(CHALLENGER, [invited, accepted, cleared])).toBeNull()
  })

  it('stops picking when the opponent walks away from the library', () => {
    expect(pick(OPPONENT, [invited, accepted, exitBattlePick()])).toBeNull()
  })
})

describe('battle on stage', () => {
  // one fixture, not two calls: the defaults are stamped off Date.now()
  const versus = battleTurn()
  const turnArrives = { type: BATTLE_TURN, payload: versus }

  it('holds the beat the server sent', () => {
    expect(run(CHALLENGER, [turnArrives]).battle.turn).toEqual(versus)
  })

  it('clears the beat when the battle is over', () => {
    expect(run(CHALLENGER, [turnArrives, { type: BATTLE_TURN_CLEAR }]).battle.turn).toBeNull()
  })

  it('frees the player only when the row is unavailable', () => {
    const reqTurn = (status: string) => ({
      type: BATTLE_REQ_TURN + _SUCCESS,
      payload: { queueId: 7, status },
    })

    // 'inProgress' is what a duplicate request looks like under React's
    // double-invoked effects; treating it as resolved ends the battle after
    // its first beat
    expect(run(CHALLENGER, [reqTurn('started')]).battle.resolvedQueueId).toBe(-1)
    expect(run(CHALLENGER, [reqTurn('inProgress')]).battle.resolvedQueueId).toBe(-1)
    expect(run(CHALLENGER, [reqTurn('unavailable')]).battle.resolvedQueueId).toBe(7)
  })

  it('forgets everything on logout', () => {
    const after = run(CHALLENGER, [singersArrive, invited, accepted, turnArrives, { type: LOGOUT }])
    expect(after.battle).toEqual(run(CHALLENGER, []).battle)
  })
})
