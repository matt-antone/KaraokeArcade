import { beforeEach, describe, expect, it, vi } from 'vitest'
import setRoomTransport from './transport.js'
import Rooms from './Rooms.js'
import Queue from '../Queue/Queue.js'
import Trivia from '../Trivia/Trivia.js'
import {
  BATTLE_INVITE_CLEAR,
  BATTLE_TURN_CLEAR,
  PLAYER_CMD_HISTORY_RESET,
  PLAYER_CMD_PAUSE,
  QUEUE_PUSH,
  ROOM_STATUS_PUSH,
} from '../../shared/actionTypes.js'

vi.mock('./Rooms.js', () => ({
  default: {
    setStatus: vi.fn(),
    prefix: (roomId: number) => `ROOM_ID_${roomId}`,
  },
}))

vi.mock('../Queue/Queue.js', () => ({
  default: {
    clear: vi.fn(),
    get: vi.fn(() => ({ result: [], entities: {}, pausedUserIds: [] })),
  },
}))

vi.mock('../Trivia/Trivia.js', () => ({
  default: {
    resetScores: vi.fn(),
    stopRoom: vi.fn(),
  },
}))

const ROOM_ID = 7

const fakeIo = () => {
  const emit = vi.fn()
  return { emit, io: { to: vi.fn(() => ({ emit })) } }
}

const typesEmitted = (emit: ReturnType<typeof vi.fn>) =>
  emit.mock.calls.map(([, action]) => action.type)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('setRoomTransport', () => {
  it('records the status and leaves a playing room alone', () => {
    const { emit, io } = fakeIo()
    setRoomTransport(io, ROOM_ID, 'play')

    expect(Rooms.setStatus).toHaveBeenCalledWith(ROOM_ID, 'play')
    // the room is told where its transport is even when nothing else happens:
    // this is what un-blocks the library on every phone in it
    expect(typesEmitted(emit)).toEqual([ROOM_STATUS_PUSH])
    expect(Queue.clear).not.toHaveBeenCalled()
  })

  // an intermission, not the end of the night: the room is off the stage but
  // the queue and the scoreboard are exactly where it left them
  it('stops the player on pause without emptying anything', () => {
    const { emit, io } = fakeIo()
    setRoomTransport(io, ROOM_ID, 'paused')

    expect(Rooms.setStatus).toHaveBeenCalledWith(ROOM_ID, 'paused')
    expect(typesEmitted(emit)).toEqual([ROOM_STATUS_PUSH, PLAYER_CMD_PAUSE])
    expect(Queue.clear).not.toHaveBeenCalled()
    expect(Trivia.resetScores).not.toHaveBeenCalled()
  })

  it('empties the queue and the scoreboard on stop', () => {
    const { emit, io } = fakeIo()
    setRoomTransport(io, ROOM_ID, 'stopped')

    expect(Queue.clear).toHaveBeenCalledWith(ROOM_ID)
    expect(Trivia.resetScores).toHaveBeenCalledWith(ROOM_ID)
    // a round mid-flight would otherwise re-queue into the room just emptied
    expect(Trivia.stopRoom).toHaveBeenCalledWith(ROOM_ID)
    expect(typesEmitted(emit)).toEqual([
      ROOM_STATUS_PUSH,
      PLAYER_CMD_PAUSE,
      BATTLE_TURN_CLEAR,
      BATTLE_INVITE_CLEAR,
      QUEUE_PUSH,
      PLAYER_CMD_HISTORY_RESET,
    ])
  })

  // Stopping a room disconnects nobody, so a fight the server has just thrown
  // away is still on every screen that was watching it. The beat would sit
  // there until its own deadline — up to two minutes on a singing beat — and a
  // challenge waiting for an answer has no deadline at all, so its modal would
  // never come down.
  it('takes a battle off the room it just stopped', () => {
    const { emit, io } = fakeIo()
    setRoomTransport(io, ROOM_ID, 'stopped')

    expect(typesEmitted(emit)).toContain(BATTLE_TURN_CLEAR)
    expect(typesEmitted(emit)).toContain(BATTLE_INVITE_CLEAR)
  })

  // Pause is the reversible half: the fight is still on when the room comes
  // back, so nothing is cleared out from under it.
  it('leaves a battle alone on pause', () => {
    const { emit, io } = fakeIo()
    setRoomTransport(io, ROOM_ID, 'paused')

    expect(typesEmitted(emit)).not.toContain(BATTLE_TURN_CLEAR)
    expect(typesEmitted(emit)).not.toContain(BATTLE_INVITE_CLEAR)
  })

  it('talks to the named room, not whichever one the admin is signed into', () => {
    const { io } = fakeIo()
    setRoomTransport(io, ROOM_ID, 'stopped')

    for (const [target] of io.to.mock.calls) {
      expect(target).toBe(`ROOM_ID_${ROOM_ID}`)
    }
  })

  it('does not touch the room when the status is rejected', () => {
    vi.mocked(Rooms.setStatus).mockImplementationOnce(() => {
      throw new Error('Invalid room status')
    })
    const { emit, io } = fakeIo()

    expect(() => setRoomTransport(io, ROOM_ID, 'nonsense')).toThrow()
    expect(emit).not.toHaveBeenCalled()
    expect(Queue.clear).not.toHaveBeenCalled()
  })
})
