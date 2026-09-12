import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db, open, close } from '../lib/Database.js'
import Queue from '../Queue/Queue.js'
import User from './User.js'

const ROOM_ID = 1
const OTHER_ROOM_ID = 2
const ALICE = 1
const BOB = 2

describe('song history', () => {
  beforeEach(() => {
    close()
    open({ file: ':memory:', ro: false })

    db.run('INSERT INTO rooms (roomId, name, status) VALUES (?, ?, ?)', [ROOM_ID, 'Room', 'open'])
    db.run('INSERT INTO rooms (roomId, name, status) VALUES (?, ?, ?)', [OTHER_ROOM_ID, 'Other', 'open'])
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

  afterEach(() => {
    vi.useRealTimers()
    close()
  })

  it('keeps one row per song, most recent play first', () => {
    vi.useFakeTimers()
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    Queue.add({ roomId: ROOM_ID, songId: 11, userId: ALICE })
    const [sweetDreams, rain] = Queue.get(ROOM_ID).result

    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    User.addPlay({ queueId: sweetDreams, roomId: ROOM_ID })

    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
    User.addPlay({ queueId: rain, roomId: ROOM_ID })

    // singing it again replaces the older play instead of adding a row
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'))
    User.addPlay({ queueId: sweetDreams, roomId: ROOM_ID })

    expect(User.getHistory(ALICE)).toEqual([
      { songId: 10, artist: 'Eurythmics', title: 'Sweet Dreams', dateSung: 1767398400 },
      { songId: 11, artist: 'Eurythmics', title: 'Here Comes The Rain', dateSung: 1767312000 },
    ])
  })

  it('records both fighters of a battle, each under the song they sang', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    // One row, two singers, two songs — and neither of them chose their own.
    // The opponent's half lives in the opponent* columns rather than in a row
    // of its own, so a play recorded off queue.songId alone leaves somebody who
    // sang for two minutes missing from their own history.
    const queueId = Queue.addBattle({
      roomId: ROOM_ID,
      challengerUserId: ALICE,
      challengerSongId: 10,
      opponentUserId: BOB,
      opponentSongId: 11,
    })

    expect(User.addPlay({ queueId, roomId: ROOM_ID })).toBe(2)

    expect(User.getHistory(ALICE)).toEqual([
      { songId: 10, artist: 'Eurythmics', title: 'Sweet Dreams', dateSung: 1767225600 },
    ])
    expect(User.getHistory(BOB)).toEqual([
      { songId: 11, artist: 'Eurythmics', title: 'Here Comes The Rain', dateSung: 1767225600 },
    ])
  })

  it('ignores a queueId from another room', () => {
    Queue.add({ roomId: ROOM_ID, songId: 10, userId: ALICE })
    const [queueId] = Queue.get(ROOM_ID).result

    expect(User.addPlay({ queueId, roomId: OTHER_ROOM_ID })).toBe(0)
    expect(User.getHistory(ALICE)).toEqual([])
  })
})
