import { describe, it, expect } from 'vitest'
import getRoundRobinQueue from './getRoundRobinQueue'

// alice (1) queued 3 songs before bob (2) queued 2
const ENTITIES = {
  1: { queueId: 1, songId: 10, userId: 1, prevQueueId: null as number | null },
  2: { queueId: 2, songId: 11, userId: 1, prevQueueId: 1 },
  3: { queueId: 3, songId: 12, userId: 1, prevQueueId: 2 },
  4: { queueId: 4, songId: 13, userId: 2, prevQueueId: 3 },
  5: { queueId: 5, songId: 14, userId: 2, prevQueueId: 4 },
}

const state = ({ history = [], queueId = null, pausedUserIds = [], nextUserId = null }: {
  history?: number[]
  queueId?: number | null
  pausedUserIds?: number[]
  nextUserId?: number | null
} = {}) => ({
  queue: { isLoading: false, result: [1, 2, 3, 4, 5], entities: ENTITIES, pausedUserIds },
  status: {
    historyJSON: JSON.stringify(history),
    queueId,
    isAtQueueEnd: false,
    nextUserId,
  },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any

describe('getRoundRobinQueue', () => {
  it('alternates singers', () => {
    expect(getRoundRobinQueue(state()).result).toEqual([1, 4, 2, 5, 3])
  })

  it('drops a paused singer\'s upcoming songs', () => {
    expect(getRoundRobinQueue(state({ pausedUserIds: [2] })).result).toEqual([1, 2, 3])
  })

  it('keeps a paused singer\'s sung songs and the song they\'re singing', () => {
    expect(getRoundRobinQueue(state({ history: [1, 4], queueId: 4, pausedUserIds: [2] })).result)
      .toEqual([1, 4, 2, 3])
  })

  it('re-queues round robin on resume', () => {
    // alice sang two in a row while bob was out
    const played = { history: [1, 2], queueId: 2 }
    expect(getRoundRobinQueue(state({ ...played, pausedUserIds: [2] })).result).toEqual([1, 2, 3])
    expect(getRoundRobinQueue(state(played)).result).toEqual([1, 2, 4, 3, 5])
  })

  it('does not lock in a singer who just paused', () => {
    expect(getRoundRobinQueue(state({ history: [1], queueId: 1, nextUserId: 2, pausedUserIds: [2] })).result)
      .toEqual([1, 2, 3])
  })
})

/**
 * A trivia round takes its turn in the rotation the way a singer does: it is
 * spaced by the same round-robin, under its own userId of 0.
 *
 * The first version of this parked the round at the back of the queue. That
 * reads fine with two songs waiting and is useless with fifteen — the round
 * sat an hour out and the room never reached it.
 */
describe('getRoundRobinQueue with a trivia round', () => {
  const withTrivia = (triviaPrevQueueId: number | null, order: number[], history: number[] = []) => ({
    queue: {
      isLoading: false,
      result: order,
      entities: {
        ...ENTITIES,
        9: { queueId: 9, type: 'trivia', songId: 0, userId: 0, prevQueueId: triviaPrevQueueId },
      },
      pausedUserIds: [] as number[],
    },
    status: { historyJSON: JSON.stringify(history), queueId: null, isAtQueueEnd: false, nextUserId: null },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

  it('takes a turn one lap in, not at the back of the queue', () => {
    // alice and bob are waiting, so the round loses the first-pass tie to both
    // and comes up on the next lap — never last, however deep the queue is
    expect(getRoundRobinQueue(withTrivia(5, [1, 2, 3, 4, 5, 9])).result)
      .toEqual([1, 4, 9, 2, 5, 3])
  })

  it('takes its first turn in the order it joined, as a singer would', () => {
    // the round went in ahead of bob's songs, so it gets its first turn ahead
    // of bob — the same first-come rule the rotation already applies to a
    // singer who arrives mid-party
    expect(getRoundRobinQueue(withTrivia(3, [1, 2, 3, 9, 4, 5])).result)
      .toEqual([1, 9, 4, 2, 5, 3])
  })

  it('never drifts to the back as more songs are queued', () => {
    // the bug this replaced: appended last, the round moved further out with
    // every song anyone added, so a busy room never reached one at all
    const deep = getRoundRobinQueue(withTrivia(5, [1, 2, 3, 4, 5, 9])).result
    expect(deep.indexOf(9)).toBeLessThan(deep.length - 1)
  })

  it('does not spend a singer\'s turn on the round', () => {
    // strip the round out and the singers still alternate exactly as they did
    // before trivia existed
    const withRound = getRoundRobinQueue(withTrivia(5, [1, 2, 3, 4, 5, 9])).result
    expect(withRound.filter(id => id !== 9)).toEqual([1, 4, 2, 5, 3])
  })

  it('waits a full lap again once it has been played', () => {
    // played, so it is the most recently seen participant and goes to the back
    // of the spacing — the same rule that stops one singer going twice running
    expect(getRoundRobinQueue(withTrivia(null, [9, 1, 2, 3, 4, 5], [9])).result)
      .toEqual([9, 1, 4, 2, 5, 3])
  })
})

/**
 * A round the server has already asked must never be offered a turn again.
 *
 * The bug: play history lives in the running player and is not persisted, so
 * after a reload the player had no memory of rounds already asked. It kept
 * landing on spent rows, the server said "nothing here", and the room saw the
 * intermission hand straight over to the next song — five times over.
 */
describe('getRoundRobinQueue with spent trivia rounds', () => {
  const withRounds = (rounds: Array<{ queueId: number, isPlayed: boolean }>, order: number[]) => ({
    queue: {
      isLoading: false,
      result: order,
      entities: {
        ...ENTITIES,
        ...Object.fromEntries(rounds.map(r => [r.queueId, {
          queueId: r.queueId,
          type: 'trivia',
          songId: 0,
          userId: 0,
          isPlayed: r.isPlayed,
          prevQueueId: null as number | null,
        }])),
      },
      pausedUserIds: [] as number[],
    },
    status: { historyJSON: '[]', queueId: null, isAtQueueEnd: false, nextUserId: null },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

  it('gives a spent round no turn at all', () => {
    const result = getRoundRobinQueue(withRounds([{ queueId: 9, isPlayed: true }], [9, 1, 2, 3, 4, 5])).result

    expect(result).not.toContain(9)
    expect(result).toEqual([1, 4, 2, 5, 3])
  })

  it('still gives the round that has not been asked its turn', () => {
    const rounds = [{ queueId: 9, isPlayed: true }, { queueId: 8, isPlayed: false }]
    const result = getRoundRobinQueue(withRounds(rounds, [9, 1, 2, 3, 8, 4, 5])).result

    expect(result).not.toContain(9)
    expect(result).toContain(8)
  })

  it('drops a whole run of spent rounds rather than skipping a turn each', () => {
    // exactly the state that produced "no quiz at all": several spent rows
    // queued together, each burning a turn on the way past
    const spent = [241, 242, 244, 245].map(queueId => ({ queueId, isPlayed: true }))
    const result = getRoundRobinQueue(
      withRounds([...spent, { queueId: 246, isPlayed: false }], [1, 2, 3, 4, 5, 241, 242, 244, 245, 246]),
    ).result

    expect(result.filter(id => [241, 242, 244, 245].includes(id))).toEqual([])
    expect(result).toContain(246)
  })
})

/**
 * A battle is dealt under its own reserved id, not under either fighter.
 *
 * Its row carries a real userId — the challenger's — because the fight needs
 * to know who is in it. Deal on that and being challenged buys a free turn:
 * the opponent sings the battle, is still recorded as never having sung, and
 * the rotation hands them their own song immediately afterwards.
 */
describe('getRoundRobinQueue with a battle', () => {
  // alice (1) challenged bob (2). alice has songs 2 and 3 left, bob has 4 and 5.
  const withBattle = (
    order: number[],
    history: number[] = [],
    queueId: number | null = null,
    nextUserId: number | null = null,
  ) => ({
    queue: {
      isLoading: false,
      result: order,
      entities: {
        ...ENTITIES,
        7: { queueId: 7, type: 'battle', songId: 20, userId: 1, opponentUserId: 2, prevQueueId: null },
      },
      pausedUserIds: [] as number[],
    },
    status: { historyJSON: JSON.stringify(history), queueId, isAtQueueEnd: false, nextUserId },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

  it('takes a turn as itself rather than as the challenger', () => {
    // alice, bob and the battle are three participants, so the fight lands
    // between them rather than displacing alice's own next song. Asserted as
    // the whole order: dealt as the challenger the battle comes out last,
    // which still satisfies any "it is in there somewhere" check.
    expect(getRoundRobinQueue(withBattle([1, 2, 3, 4, 5, 7])).result)
      .toEqual([1, 4, 7, 2, 5, 3])
  })

  /* The lock-in is the other half of the rotation id, and the half that bites.
   *
   * PlayerController pins the row it has committed to so the rotation cannot
   * move it. Both sides have to name that row the same way: the battle's
   * userId is the challenger's, so matching on it finds one of the
   * challenger's own songs in raw queue order and pins that instead — and the
   * fight slips one slot on every advance until it is last in the queue, which
   * is exactly what dealing it under its own id was meant to prevent. */
  it('keeps its slot when the player has locked it in', () => {
    expect(getRoundRobinQueue(withBattle([1, 2, 3, 4, 5, 7], [1], 1, -1)).result)
      .toEqual([1, 7, 4, 2, 5, 3])
  })

  it('does not let a lock-in on the challenger displace it', () => {
    // alice is locked in; the row that gets pinned must be one of alice's
    // songs, and the battle must not be pushed behind it
    const result = getRoundRobinQueue(withBattle([1, 2, 3, 4, 5, 7], [1], 1, 1)).result

    expect(result.indexOf(7)).toBeLessThan(result.indexOf(3))
  })

  it('leaves both fighters exactly where they would have been', () => {
    // The fight has been fought — alice and bob both sang in it. The strongest
    // statement of "the battle was its own turn" is that what follows is the
    // identical rotation to a queue that never had a battle in it: being in
    // one neither costs a fighter their place nor buys them a better one.
    const after = getRoundRobinQueue(withBattle([7, 1, 2, 3, 4, 5], [7], 7)).result
    const baseline = getRoundRobinQueue(state()).result

    expect(after[0]).toBe(7)
    expect(after.slice(1)).toEqual(baseline)
  })

  it('leaves with a challenger who sits out', () => {
    const paused = { ...withBattle([1, 2, 3, 4, 5, 7]) }
    paused.queue.pausedUserIds = [1]

    expect(getRoundRobinQueue(paused).result).not.toContain(7)
  })
})
