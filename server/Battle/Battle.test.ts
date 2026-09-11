/**
 * A battle is the first queue row with two singers and two songs on it, and
 * almost everything that can go wrong with one is invisible until a party is
 * running. These tests pin down the four that would be worst to find then:
 *
 *  - converting the challenger's row in place has to keep its slot in the
 *    prevQueueId chain, or agreeing to a battle silently reorders the queue;
 *  - a challenger with no turn to spend still gets their fight, at the tail;
 *  - Queue.get has to resolve each fighter's media from that fighter's own
 *    song. The old query leaned on SQLite handing back bare columns from the
 *    row that produced a lone MAX(), and a second plain join would have made
 *    that MAX() range over both songs' media at once — a battle playing one
 *    singer's file to the other singer's name, with nothing in any log;
 *  - and the beats have to skip the two metering ones on a player that cannot
 *    hear the room, rather than grading thirty seconds of silence.
 *
 * Battle.stopRoom is called in both setup and teardown: the module's maps
 * outlive the :memory: database between tests, which is the same reason the
 * trivia tests stop their room twice.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db, open, close } from '../lib/Database.js'
import Battle from './Battle.js'
import Queue from '../Queue/Queue.js'
import {
  BATTLE_INVITE,
  BATTLE_INVITE_CLEAR,
  BATTLE_TURN,
  BATTLE_TURN_CLEAR,
} from '../../shared/actionTypes.js'
import type { BattlePhase, BattleTurn } from '../../shared/types.js'

const ROOM_ID = 1
const ALICE = 1
const BOB = 2
const CAROL = 3

/** Songs. Each has two media files in folders of different priority, which is
 *  the case that tells a correct media resolution from a lucky one. */
const SWEET = 10
const RAIN = 11
const MISSIONARY = 12

interface Emitted { type: string, payload?: unknown }

/** Enough of socket.io's server to see what was emitted and to whom. The room
 *  holds Alice, Bob, Carol — Bob twice, because one person with a phone and a
 *  tablet is the ordinary case — plus the player display, which is told apart
 *  by _lastPlayerStatus exactly as Rooms.isPlayerPresent tells it apart. */
function fakeIo () {
  const emitted: (Emitted & { target: string })[] = []
  const sockets = [
    { id: 'sA', user: { userId: ALICE, name: 'Alice', dateUpdated: 0, roomId: ROOM_ID } },
    { id: 'sB', user: { userId: BOB, name: 'Bob', dateUpdated: 0, roomId: ROOM_ID } },
    { id: 'sB2', user: { userId: BOB, name: 'Bob', dateUpdated: 0, roomId: ROOM_ID } },
    { id: 'sC', user: { userId: CAROL, name: 'Carol', dateUpdated: 0, roomId: ROOM_ID } },
    { id: 'sP', user: { userId: ALICE, name: 'Alice', dateUpdated: 0, roomId: ROOM_ID }, _lastPlayerStatus: { isPlaying: true } },
  ]

  return {
    emitted,
    sockets,
    to: (target: string) => ({ emit: (_e: string, action: Emitted) => emitted.push({ target, ...action }) }),
    in: () => ({ fetchSockets: async () => sockets }),
    of: () => ({ sockets: new Map() }),
  }
}

const user = (userId: number, name: string) =>
  db.run(`INSERT INTO users (userId, username, password, name, roleId)
    VALUES (?, ?, 'x', ?, (SELECT roleId FROM roles WHERE name = 'standard'))`, [userId, name.toLowerCase(), name])

const song = (songId: number, title: string) =>
  db.run('INSERT INTO songs (songId, artistId, title, titleNorm) VALUES (?, 1, ?, ?)',
    [songId, title, title.toLowerCase()])

/** Two files for one song, in two folders: the low-priority one first so a
 *  query that simply takes whatever it scanned first gets it wrong. */
const media = (songId: number, loId: number, hiId: number, ext: string) => {
  db.run('INSERT INTO media (mediaId, songId, pathId, relPath, duration, isPreferred) VALUES (?, ?, 2, ?, 60, 0)',
    [loId, songId, `low-${songId}.${ext}`])
  db.run('INSERT INTO media (mediaId, songId, pathId, relPath, duration, isPreferred) VALUES (?, ?, 1, ?, 60, 0)',
    [hiId, songId, `high-${songId}.${ext}`])
}

const queueSong = (userId: number, songId = SWEET) =>
  Queue.add({ roomId: ROOM_ID, songId, userId })

/** A fresh in-memory database holding one open room with battles on, three
 *  singers, and three songs that each have two files. */
function setupRoom () {
  Battle.stopRoom(ROOM_ID)
  close()
  open({ file: ':memory:', ro: false })

  db.run('INSERT INTO rooms (roomId, name, status, data) VALUES (?, ?, ?, ?)',
    [ROOM_ID, 'Room', 'play', JSON.stringify({ prefs: { battle: { isEnabled: true } } })])
  user(ALICE, 'Alice')
  user(BOB, 'Bob')
  user(CAROL, 'Carol')

  db.run('INSERT INTO artists (artistId, name, nameNorm) VALUES (1, ?, ?)', ['Eurythmics', 'eurythmics'])
  song(SWEET, 'Sweet Dreams')
  song(RAIN, 'Here Comes The Rain')
  song(MISSIONARY, 'Missionary Man')

  // priority 1 wins over priority 2 — Library.get orders by priority ASC too
  db.run('INSERT INTO paths (pathId, path, priority, data) VALUES (1, ?, 1, ?)', ['/best', '{}'])
  db.run('INSERT INTO paths (pathId, path, priority, data) VALUES (2, ?, 2, ?)', ['/rest', '{}'])

  // different extensions per song, so a file resolved from the wrong song
  // shows up as the wrong mediaType as well as the wrong mediaId
  media(SWEET, 100, 101, 'mp4')
  media(RAIN, 200, 201, 'cdg')
  media(MISSIONARY, 300, 301, 'mp4')
}

/** Switch the room to one of the two ways of deciding a fight. Absent by
 *  default, the way a room made before the choice existed carries it. */
const setJudging = (judging: 'ballot' | 'crowd') =>
  db.run('UPDATE rooms SET data = ? WHERE roomId = ?',
    [JSON.stringify({ prefs: { battle: { isEnabled: true, judging } } }), ROOM_ID])

function teardownRoom () {
  Battle.stopRoom(ROOM_ID)
  close()
}

/**
 * Run the whole negotiation: Alice challenges Bob to sing `opponentSongId`,
 * Bob accepts and hands Alice `challengerSongId` back. `queueId` is the row
 * Alice puts up as the slot to fight in.
 */
async function negotiate (io, { queueId, opponentSongId = RAIN, challengerSongId = MISSIONARY } = {} as {
  queueId: number
  opponentSongId?: number
  challengerSongId?: number
}) {
  await Battle.challenge(io, {
    roomId: ROOM_ID,
    challengerUserId: ALICE,
    opponentUserId: BOB,
    songId: opponentSongId,
    queueId,
  })
  await Battle.accept(io, ROOM_ID, BOB)
  await Battle.pick(io, ROOM_ID, BOB, challengerSongId)
}

describe('the challenge', () => {
  beforeEach(setupRoom)
  afterEach(teardownRoom)

  it('lists everyone in the room but the asker, once each, without the player', async () => {
    const io = fakeIo()
    const singers = await Battle.getSingers(io, ROOM_ID, ALICE)

    // Alice is asking, so she is out; Bob is on two devices and appears once;
    // the player display's socket carries Alice's own user and is dropped for
    // being a player rather than for being Alice
    expect(singers.map(s => s.name)).toEqual(['Bob', 'Carol'])
  })

  it('refuses when the room has battles switched off', async () => {
    db.run('UPDATE rooms SET data = ? WHERE roomId = ?', [JSON.stringify({ prefs: {} }), ROOM_ID])

    await expect(negotiate(fakeIo(), { queueId: 0 })).rejects.toThrow(/switched off/)
  })

  it('reaches both fighters and nobody else, and clears on decline', async () => {
    const io = fakeIo()

    await Battle.challenge(io, {
      roomId: ROOM_ID, challengerUserId: ALICE, opponentUserId: BOB, songId: RAIN, queueId: 0,
    })

    const invites = io.emitted.filter(e => e.type === BATTLE_INVITE)

    // Alice's one socket and both of Bob's; Carol's and the player's are not
    // in a battle and are never told there is one
    expect(invites.map(e => e.target).sort()).toEqual(['sA', 'sB', 'sB2'])
    expect((invites[0].payload as { title: string }).title).toBe('Here Comes The Rain')
    expect(Battle.getInvite(ROOM_ID)?.isAccepted).toBe(false)

    await Battle.clearInvite(io, ROOM_ID, BOB)

    expect(Battle.getInvite(ROOM_ID)).toBeNull()
    expect(io.emitted.filter(e => e.type === BATTLE_INVITE_CLEAR)).toHaveLength(3)
  })

  it('only lets one challenge be negotiated at a time', async () => {
    const io = fakeIo()

    await Battle.challenge(io, {
      roomId: ROOM_ID, challengerUserId: ALICE, opponentUserId: BOB, songId: RAIN, queueId: 0,
    })

    await expect(Battle.challenge(io, {
      roomId: ROOM_ID, challengerUserId: CAROL, opponentUserId: BOB, songId: RAIN, queueId: 0,
    })).rejects.toThrow(/being challenged/)
  })
})

describe('where the battle lands in the queue', () => {
  beforeEach(setupRoom)
  afterEach(teardownRoom)

  it('converts the challenger\'s own row in place, keeping its slot', async () => {
    queueSong(ALICE) // 1
    queueSong(BOB) //   2
    queueSong(ALICE) // 3
    queueSong(CAROL) // 4

    await negotiate(fakeIo(), { queueId: 3 })

    const { result, entities } = Queue.get(ROOM_ID)

    // the chain is untouched: the battle is exactly where Alice's second turn
    // was, so agreeing to one costs her the turn she already had rather than
    // buying her another
    expect(result).toEqual([1, 2, 3, 4])
    expect(entities[3].type).toBe('battle')
    expect(entities[3].userId).toBe(ALICE)
    expect(entities[3].songId).toBe(MISSIONARY)
    expect(entities[3].opponentUserId).toBe(BOB)
    expect(entities[3].opponentSongId).toBe(RAIN)
    expect(entities[3].opponentDisplayName).toBe('Bob')
  })

  it('appends at the tail when the challenger has no turn to spend', async () => {
    queueSong(BOB) // 1

    await negotiate(fakeIo(), { queueId: 0 })

    const { result, entities } = Queue.get(ROOM_ID)

    expect(result).toHaveLength(2)
    expect(entities[result[1]].type).toBe('battle')
    expect(entities[result[1]].userId).toBe(ALICE)
  })

  it('appends when the row offered is no longer the challenger\'s to spend', async () => {
    queueSong(BOB) // 1, Bob's — Alice cannot convert it

    await negotiate(fakeIo(), { queueId: 1 })

    const { result, entities } = Queue.get(ROOM_ID)

    expect(entities[1].type).toBe('song')
    expect(entities[1].userId).toBe(BOB)
    expect(result).toHaveLength(2)
    expect(entities[result[1]].type).toBe('battle')
  })

  it('makes the opponent an owner of the row, so they can move or leave it', async () => {
    queueSong(ALICE)
    await negotiate(fakeIo(), { queueId: 1 })

    expect(Queue.isOwner(BOB, 1)).toBe(true)
    expect(Queue.isOwner(ALICE, 1)).toBe(true)
    expect(Queue.isOwner(CAROL, 1)).toBe(false)
  })
})

describe('resolving both fighters\' media', () => {
  beforeEach(setupRoom)
  afterEach(teardownRoom)

  it('gives each singer the preferred file for their own song', async () => {
    queueSong(ALICE)
    await negotiate(fakeIo(), { queueId: 1 })

    const row = Queue.get(ROOM_ID).entities[1]

    // Alice sings Missionary Man, so hers is the priority-1 copy of song 12,
    // and Bob's is the priority-1 copy of song 11 — never the other way round
    // and never the priority-2 copy of either
    expect(row.songId).toBe(MISSIONARY)
    expect(row.mediaId).toBe(301)
    expect(row.mediaType).toBe('mp4')

    expect(row.opponentSongId).toBe(RAIN)
    expect(row.opponentMediaId).toBe(201)
    expect(row.opponentMediaType).toBe('cdg')
  })

  it('leaves an ordinary song row reading exactly as it did', () => {
    queueSong(ALICE)

    const row = Queue.get(ROOM_ID).entities[1]

    expect(row.mediaId).toBe(101)
    expect(row.opponentUserId).toBe(0)
    expect(row.opponentSongId).toBe(0)
    expect(row.opponentDisplayName).toBe('')
    expect(row.opponentMediaId).toBe(0)
    expect(row.opponentMediaType).toBeNull()
  })

  it('drops a battle whose second song lost its files to a rescan', async () => {
    queueSong(CAROL)
    queueSong(ALICE)
    await negotiate(fakeIo(), { queueId: 2 })

    expect(Queue.get(ROOM_ID).result).toContain(2)

    // Bob's half is now unplayable. The old filter let any non-song row
    // through, so the player would have reached this row and stood on it.
    db.run('DELETE FROM media WHERE songId = ?', [RAIN])

    expect(Queue.get(ROOM_ID).result).not.toContain(2)
  })
})

describe('the beats', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setupRoom()
  })

  afterEach(() => {
    teardownRoom()
    vi.useRealTimers()
  })

  /** Start a battle and let every timer run out, collecting the phases. */
  async function runBattle (io, canHearRoom: boolean) {
    queueSong(ALICE)
    await negotiate(io, { queueId: 1 })

    io.emitted.length = 0
    Battle.startTurn(io, ROOM_ID, 1, canHearRoom)

    // longer than the whole sequence; nested timers are advanced too
    await vi.advanceTimersByTimeAsync(600000)

    return io.emitted
      .filter(e => e.type === BATTLE_TURN)
      .map(e => (e.payload as BattleTurn).phase as BattlePhase)
  }

  it('runs the ballot beat by default, and no metering beat', async () => {
    const io = fakeIo()

    // The room pref is absent, which is every room made before there was a
    // choice — and the answer has to be the one that works on a player opened
    // anywhere, not the one that needs the host's own microphone.
    expect(await runBattle(io, true)).toEqual([
      'versus', 'intro1', 'sing1', 'intro2', 'sing2', 'judge', 'ballot', 'winner',
    ])
  })

  it('runs all nine beats when the room asked for crowd noise and the player can hear it', async () => {
    const io = fakeIo()
    setJudging('crowd')

    expect(await runBattle(io, true)).toEqual([
      'versus', 'intro1', 'sing1', 'intro2', 'sing2', 'judge', 'meter1', 'meter2', 'winner',
    ])
    expect(io.emitted.some(e => e.type === BATTLE_TURN_CLEAR)).toBe(true)
    expect(Battle.getTurn(ROOM_ID)).toBeNull()
  })

  it('skips both metering beats when it cannot', async () => {
    const io = fakeIo()
    setJudging('crowd')

    // grading a room the player cannot hear hands the fight to whoever the
    // rounding favoured, so the beats simply do not happen
    expect(await runBattle(io, false)).toEqual([
      'versus', 'intro1', 'sing1', 'intro2', 'sing2', 'judge', 'winner',
    ])
  })

  it('refuses a row that is not a battle, and never starts two', async () => {
    const io = fakeIo()
    queueSong(ALICE)
    await negotiate(io, { queueId: 1 })

    queueSong(CAROL) // an ordinary song row

    expect(Battle.startTurn(io, ROOM_ID, 2, false)).toBeNull()
    expect(Battle.startTurn(io, ROOM_ID, 1, false)).not.toBeNull()
    expect(Battle.startTurn(io, ROOM_ID, 1, false)).toBeNull()
    expect(Battle.isTurnInProgress(ROOM_ID, 1)).toBe(true)
  })

  it('ends a singing beat early when the song runs out, and only that beat', async () => {
    const io = fakeIo()
    queueSong(ALICE)
    await negotiate(io, { queueId: 1 })

    Battle.startTurn(io, ROOM_ID, 1, false)
    await vi.advanceTimersByTimeAsync(10000) // versus, intro1
    expect(Battle.getTurn(ROOM_ID)?.phase).toBe('sing1')

    // the opponent's side reported against the challenger's beat is a stale
    // report and must not skip anything
    Battle.songEnded(io, ROOM_ID, 1, 2)
    expect(Battle.getTurn(ROOM_ID)?.phase).toBe('sing1')

    Battle.songEnded(io, ROOM_ID, 1, 1)
    expect(Battle.getTurn(ROOM_ID)?.phase).toBe('intro2')
  })

  it('counts the ballot silently and hands the tally to the verdict', async () => {
    const io = fakeIo()
    queueSong(ALICE)
    await negotiate(io, { queueId: 1 })

    Battle.startTurn(io, ROOM_ID, 1, false)
    await vi.advanceTimersByTimeAsync(265000) // through judge, into the ballot
    expect(Battle.getTurn(ROOM_ID)?.phase).toBe('ballot')

    io.emitted.length = 0

    Battle.vote(ROOM_ID, 1, CAROL, 2)
    Battle.vote(ROOM_ID, 1, CAROL, 1) // changed their mind; still one vote
    Battle.vote(ROOM_ID, 1, ALICE, 1) // a fighter voting for herself: ignored
    Battle.vote(ROOM_ID, 1, BOB, 2) // and the other one

    // nothing goes out while the ballot is open — a count the room can watch
    // fill collects the undecided behind whoever is ahead
    expect(io.emitted).toEqual([])

    // out of the ballot and into the verdict, which is shorter than it is
    await vi.advanceTimersByTimeAsync(20000)

    const turn = Battle.getTurn(ROOM_ID)
    expect(turn?.phase).toBe('winner')
    expect(turn?.challengerScore).toBe(1)
    expect(turn?.opponentScore).toBe(0)

    // and a vote after the beat has closed is not a vote
    Battle.vote(ROOM_ID, 1, CAROL, 2)
    expect(Battle.getTurn(ROOM_ID)?.opponentScore).toBe(0)
  })

  it('carries both crowd grades into the verdict', async () => {
    const io = fakeIo()
    setJudging('crowd')
    queueSong(ALICE)
    await negotiate(io, { queueId: 1 })

    Battle.startTurn(io, ROOM_ID, 1, true)
    await vi.advanceTimersByTimeAsync(265000) // through judge, into meter1

    Battle.score(io, ROOM_ID, 1, 1, 61)
    Battle.score(io, ROOM_ID, 1, 2, 4200) // clamped to the maximum

    await vi.advanceTimersByTimeAsync(30000)

    const turn = Battle.getTurn(ROOM_ID)
    expect(turn?.phase).toBe('winner')
    expect(turn?.challengerScore).toBe(61)
    expect(turn?.opponentScore).toBe(100)
  })

  it('stops every timer with the room', async () => {
    const io = fakeIo()
    queueSong(ALICE)
    await negotiate(io, { queueId: 1 })

    Battle.startTurn(io, ROOM_ID, 1, false)
    io.emitted.length = 0

    Battle.stopRoom(ROOM_ID)
    await vi.advanceTimersByTimeAsync(600000)

    // a beat fired after this point lands on a queue the room has emptied
    expect(io.emitted).toEqual([])
    expect(Battle.getTurn(ROOM_ID)).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
})
