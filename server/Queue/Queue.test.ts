import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, open, close } from '../lib/Database.js'
import Queue from './Queue.js'
import { KEY_CHANGE_MAX } from '../../shared/types.js'

const ROOM_ID = 1
const ALICE = 1
const BOB = 2

describe('singer pause', () => {
  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })

    db.run('INSERT INTO rooms (roomId, name, status) VALUES (?, ?, ?)', [ROOM_ID, 'Room', 'play'])
    db.run(`INSERT INTO users (userId, username, password, name, roleId)
      VALUES (?, ?, ?, ?, (SELECT roleId FROM roles WHERE name = 'standard'))`, [ALICE, 'alice', 'x', 'Alice'])
    db.run(`INSERT INTO users (userId, username, password, name, roleId)
      VALUES (?, ?, ?, ?, (SELECT roleId FROM roles WHERE name = 'standard'))`, [BOB, 'bob', 'x', 'Bob'])
    db.run('INSERT INTO artists (artistId, name, nameNorm) VALUES (1, ?, ?)', ['Eurythmics', 'eurythmics'])
    db.run('INSERT INTO songs (songId, artistId, title, titleNorm) VALUES (10, 1, ?, ?)', ['Sweet Dreams', 'sweet dreams'])
    db.run('INSERT INTO paths (pathId, path, priority, data) VALUES (1, ?, 1, ?)', ['/media', '{}'])
    db.run('INSERT INTO media (mediaId, songId, pathId, relPath, duration, isPreferred) VALUES (100, 10, 1, ?, 60, 1)', ['a.mp4'])
  })

  afterEach(close)

  it('has nobody paused to start', () => {
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    expect(Queue.get(ROOM_ID).pausedUserIds).toEqual([])
  })

  it('pauses and resumes a singer without touching their songs', () => {
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: BOB })

    Queue.setPaused({ isPaused: true, roomId: ROOM_ID, userId: BOB })
    Queue.setPaused({ isPaused: true, roomId: ROOM_ID, userId: BOB }) // idempotent
    expect(Queue.get(ROOM_ID).pausedUserIds).toEqual([BOB])
    expect(Queue.get(ROOM_ID).result).toHaveLength(1)

    Queue.setPaused({ isPaused: false, roomId: ROOM_ID, userId: BOB })
    expect(Queue.get(ROOM_ID).pausedUserIds).toEqual([])
    expect(Queue.get(ROOM_ID).result).toHaveLength(1)
  })
})

describe('clear', () => {
  const ROOM_2 = 2

  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })

    db.run('INSERT INTO rooms (roomId, name, status) VALUES (?, ?, ?)', [ROOM_ID, 'Room', 'play'])
    db.run('INSERT INTO rooms (roomId, name, status) VALUES (?, ?, ?)', [ROOM_2, 'Other', 'play'])
    db.run(`INSERT INTO users (userId, username, password, name, roleId)
      VALUES (?, ?, ?, ?, (SELECT roleId FROM roles WHERE name = 'standard'))`, [ALICE, 'alice', 'x', 'Alice'])
    db.run(`INSERT INTO users (userId, username, password, name, roleId)
      VALUES (?, ?, ?, ?, (SELECT roleId FROM roles WHERE name = 'standard'))`, [BOB, 'bob', 'x', 'Bob'])
    db.run('INSERT INTO artists (artistId, name, nameNorm) VALUES (1, ?, ?)', ['Eurythmics', 'eurythmics'])
    db.run('INSERT INTO songs (songId, artistId, title, titleNorm) VALUES (10, 1, ?, ?)', ['Sweet Dreams', 'sweet dreams'])
    db.run('INSERT INTO paths (pathId, path, priority, data) VALUES (1, ?, 1, ?)', ['/media', '{}'])
    db.run('INSERT INTO media (mediaId, songId, pathId, relPath, duration, isPreferred) VALUES (100, 10, 1, ?, 60, 1)', ['a.mp4'])
  })

  afterEach(close)

  it('empties the room and lifts its pauses', () => {
    for (let i = 0; i < 3; i++) Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    Queue.setPaused({ isPaused: true, roomId: ROOM_ID, userId: ALICE })

    Queue.clear(ROOM_ID)

    expect(Queue.get(ROOM_ID).result).toEqual([])
    expect(Queue.get(ROOM_ID).pausedUserIds).toEqual([])
  })

  it('leaves other rooms alone', () => {
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    Queue.add({ roomId: ROOM_2, songId: 10, userId: BOB })
    Queue.setPaused({ isPaused: true, roomId: ROOM_2, userId: BOB })

    Queue.clear(ROOM_ID)

    expect(Queue.get(ROOM_2).result).toHaveLength(1)
    expect(Queue.get(ROOM_2).pausedUserIds).toEqual([BOB])
  })

  // the linked list points at rows that are going away in the same statement
  it('can be added to again afterwards', () => {
    for (let i = 0; i < 3; i++) Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    Queue.clear(ROOM_ID)

    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: BOB })

    expect(Queue.get(ROOM_ID).result).toHaveLength(2)
  })
})

describe('move', () => {
  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })

    db.run('INSERT INTO rooms (roomId, name, status) VALUES (?, ?, ?)', [ROOM_ID, 'Room', 'play'])
    db.run(`INSERT INTO users (userId, username, password, name, roleId)
      VALUES (?, ?, ?, ?, (SELECT roleId FROM roles WHERE name = 'standard'))`, [ALICE, 'alice', 'x', 'Alice'])
    db.run('INSERT INTO artists (artistId, name, nameNorm) VALUES (1, ?, ?)', ['Eurythmics', 'eurythmics'])
    db.run('INSERT INTO songs (songId, artistId, title, titleNorm) VALUES (10, 1, ?, ?)', ['Sweet Dreams', 'sweet dreams'])
    db.run('INSERT INTO paths (pathId, path, priority, data) VALUES (1, ?, 1, ?)', ['/media', '{}'])
    db.run('INSERT INTO media (mediaId, songId, pathId, relPath, duration, isPreferred) VALUES (100, 10, 1, ?, 60, 1)', ['a.mp4'])

    for (let i = 0; i < 3; i++) Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
  })

  afterEach(close)

  it('starts in insertion order', () => {
    expect(Queue.get(ROOM_ID).result).toEqual([1, 2, 3])
  })

  it('moves an item to the end', () => {
    Queue.move({ prevQueueId: 3, queueId: 1, roomId: ROOM_ID })
    expect(Queue.get(ROOM_ID).result).toEqual([2, 3, 1])
  })

  it('moves an item to the top', () => {
    Queue.move({ prevQueueId: null, queueId: 3, roomId: ROOM_ID })
    expect(Queue.get(ROOM_ID).result).toEqual([3, 1, 2])
  })

  it('moves the first item into the middle', () => {
    Queue.move({ prevQueueId: 2, queueId: 1, roomId: ROOM_ID })
    expect(Queue.get(ROOM_ID).result).toEqual([2, 1, 3])
  })
})

describe('key change', () => {
  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })

    db.run('INSERT INTO rooms (roomId, name, status) VALUES (?, ?, ?)', [ROOM_ID, 'Room', 'play'])
    db.run(`INSERT INTO users (userId, username, password, name, roleId)
      VALUES (?, ?, ?, ?, (SELECT roleId FROM roles WHERE name = 'standard'))`, [ALICE, 'alice', 'x', 'Alice'])
    db.run(`INSERT INTO users (userId, username, password, name, roleId)
      VALUES (?, ?, ?, ?, (SELECT roleId FROM roles WHERE name = 'standard'))`, [BOB, 'bob', 'x', 'Bob'])
    db.run('INSERT INTO artists (artistId, name, nameNorm) VALUES (1, ?, ?)', ['Eurythmics', 'eurythmics'])
    db.run('INSERT INTO songs (songId, artistId, title, titleNorm) VALUES (10, 1, ?, ?)', ['Sweet Dreams', 'sweet dreams'])
    db.run('INSERT INTO songs (songId, artistId, title, titleNorm) VALUES (11, 1, ?, ?)', ['Here Comes The Rain', 'here comes the rain'])
    db.run('INSERT INTO paths (pathId, path, priority, data) VALUES (1, ?, 1, ?)', ['/media', '{}'])
    db.run('INSERT INTO media (mediaId, songId, pathId, relPath, duration, isPreferred) VALUES (100, 10, 1, ?, 60, 1)', ['a.mp4'])
    db.run('INSERT INTO media (mediaId, songId, pathId, relPath, duration, isPreferred) VALUES (101, 11, 1, ?, 60, 1)', ['b.mp4'])
  })

  afterEach(close)

  it('queues in the recording\'s own key by default', () => {
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    const [queueId] = Queue.get(ROOM_ID).result
    expect(Queue.get(ROOM_ID).entities[queueId].keyChange).toBe(0)
  })

  it('sets and clears a key', () => {
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    const [queueId] = Queue.get(ROOM_ID).result

    Queue.setKeyChange({ keyChange: -3, queueId })
    expect(Queue.get(ROOM_ID).entities[queueId].keyChange).toBe(-3)

    Queue.setKeyChange({ keyChange: 0, queueId })
    expect(Queue.get(ROOM_ID).entities[queueId].keyChange).toBe(0)
  })

  it('clamps a key past the supported range instead of storing it', () => {
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    const [queueId] = Queue.get(ROOM_ID).result

    Queue.setKeyChange({ keyChange: 99, queueId })
    expect(Queue.get(ROOM_ID).entities[queueId].keyChange).toBe(KEY_CHANGE_MAX)

    Queue.setKeyChange({ keyChange: -99, queueId })
    expect(Queue.get(ROOM_ID).entities[queueId].keyChange).toBe(-KEY_CHANGE_MAX)
  })

  it('remembers a singer\'s key for that song, and only for them', () => {
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    Queue.setKeyChange({ keyChange: 2, queueId: Queue.get(ROOM_ID).result[0] })

    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE }) // same singer, same song
    Queue.add({ roomId: ROOM_ID, songId: 11, userId: ALICE }) // same singer, other song
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: BOB }) //  other singer, same song

    const { result, entities } = Queue.get(ROOM_ID)
    expect(result.map(qId => entities[qId].keyChange)).toEqual([2, 2, 0, 0])
  })

  it('remembers the most recent key, not the first', () => {
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    Queue.setKeyChange({ keyChange: 4, queueId: Queue.get(ROOM_ID).result[0] })

    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    Queue.setKeyChange({ keyChange: -1, queueId: Queue.get(ROOM_ID).result[1] })

    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    const { result, entities } = Queue.get(ROOM_ID)
    expect(entities[result[2]].keyChange).toBe(-1)
  })
})

/* A queue is a linked list: every row names the one in front of it. Reading it
   back used to assume the chain covered exactly the rows that came out of the
   query, and a hole in it threw inside a socket handler — which is the server
   process, not the request. */
describe('a queue whose chain has a hole in it', () => {
  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })

    db.run('INSERT INTO rooms (roomId, name, status) VALUES (?, ?, ?)', [ROOM_ID, 'Room', 'play'])
    db.run(`INSERT INTO users (userId, username, password, name, roleId)
      VALUES (?, ?, ?, ?, (SELECT roleId FROM roles WHERE name = 'standard'))`, [ALICE, 'alice', 'x', 'Alice'])
    db.run('INSERT INTO artists (artistId, name, nameNorm) VALUES (1, ?, ?)', ['Eurythmics', 'eurythmics'])
    db.run('INSERT INTO paths (pathId, path, priority, data) VALUES (1, ?, 1, ?)', ['/media', '{}'])

    for (const songId of [10, 11, 12]) {
      db.run('INSERT INTO songs (songId, artistId, title, titleNorm) VALUES (?, 1, ?, ?)',
        [songId, `Song ${songId}`, `song ${songId}`])
      db.run(`INSERT INTO media (mediaId, songId, pathId, relPath, duration, isPreferred)
        VALUES (?, ?, 1, ?, 60, 1)`, [songId * 10, songId, `${songId}.mp4`])
      Queue.add({ roomId: ROOM_ID, songId, userId: ALICE })
    }
  })

  afterEach(close)

  it('reads back in order while the chain is whole', () => {
    expect(Queue.get(ROOM_ID).result).toEqual([1, 2, 3])
  })

  /* The one that happens on its own: a re-scan drops the media for a queued
     song, so the row is no longer playable and the query filters it out. The
     row behind it still points at it. */
  it('skips a row whose media has gone, and keeps the rest in order', () => {
    db.run('DELETE FROM media WHERE songId = 11')

    expect(Queue.get(ROOM_ID).result).toEqual([1, 3])
  })

  /* And the same hole from the other direction: the row itself is gone without
     remove() having relinked the one behind it. The foreign key stops this
     from inside the app, so this is the shape it arrives in from outside —
     the sqlite3 CLI does not turn foreign keys on. */
  it('survives a row deleted out from under the chain', () => {
    db.exec('PRAGMA foreign_keys = OFF')
    db.run('DELETE FROM queue WHERE queueId = 2')
    db.exec('PRAGMA foreign_keys = ON')

    expect(Queue.get(ROOM_ID).result).toEqual([1, 3])
  })

  it('still returns the tail when the head is the row that has gone', () => {
    db.run('DELETE FROM media WHERE songId = 10')

    expect(Queue.get(ROOM_ID).result).toEqual([2, 3])
  })

  /* Nothing in a cycle is anybody's head, so the walk never reaches it. Songs
     somebody is waiting on are worth more than a tidy order. */
  it('keeps rows that point at each other rather than dropping them', () => {
    db.run('UPDATE queue SET prevQueueId = 3 WHERE queueId = 2')

    expect(Queue.get(ROOM_ID).result.slice().sort()).toEqual([1, 2, 3])
  })
})
