import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { close, db, open } from '../lib/Database.js'
import Party from './Party.js'
import Queue from '../Queue/Queue.js'
import Rooms from '../Rooms/Rooms.js'
import Library from '../Library/Library.js'
import Points from '../Points/Points.js'
import { bingoWin, rouletteBonus, type BingoCard, type BingoSquare } from '../../shared/party.js'
import handlers from './socket.js'
import { PARTY_REQUEST } from '../../shared/party.js'

vi.mock('../Trivia/Questions.js', () => ({ fetchQuestions: vi.fn(async () => [{ question: 'Which band?', correctAnswer: 'Queen', incorrectAnswers: ['ABBA', 'Oasis', 'Blur'], difficulty: 'easy' }]) }))
const prefs = { bingo: { isEnabled: true }, roulette: { isEnabled: true }, spotTrivia: { isEnabled: true }, nameThatKaraoke: { isEnabled: true } }
const sockets = new Map<number, { id: string, user: { roomId: number, userId: number, isAdmin: boolean } }>()
const io = { of: () => ({ sockets }), to: () => ({ emit: vi.fn() }) }
const queueSong = (userId = 1, songId = 1) => {
  Queue.add({ roomId: 1, songId, userId })
  return Queue.get(1).result.at(-1)!
}
const setPrefs = (value: object) => db.run('UPDATE rooms SET data = ? WHERE roomId = 1', [JSON.stringify({ prefs: value })])
const state = (userId = 1) => Party.state(1, userId)

beforeEach(() => {
  close()
  open({ file: ':memory:', ro: false })
  db.run('INSERT INTO rooms (roomId, name, status, data) VALUES (1, \'Party\', \'play\', ?)', [JSON.stringify({ prefs })])
  sockets.clear()
  for (let id = 1; id <= 4; id++) {
    db.run('INSERT INTO users (userId, username, password, name, roleId) VALUES (?, ?, \'x\', ?, 3)', [id, `user${id}`, `Player ${id}`])
    sockets.set(id, { id: String(id), user: { roomId: 1, userId: id, isAdmin: false } })
  }
  db.run('INSERT INTO artists (artistId, name, nameNorm) VALUES (1, \'Artist\', \'artist\')')
  db.run('INSERT INTO paths (pathId, path, priority, data) VALUES (1, \'/media\', 1, \'{}\')')
  for (let id = 1; id <= 12; id++) {
    db.run('INSERT INTO songs (songId, artistId, title, titleNorm, tags) VALUES (?, 1, ?, ?, ?)', [id, `Song ${id}`, `song ${id}`, JSON.stringify(['rock', '1980s', 'happy', 'classic'])])
    db.run('INSERT INTO media (songId, pathId, relPath, duration, isPreferred) VALUES (?, 1, ?, 60, 1)', [id, `${id}.mp4`])
  }
  Library.cache = { version: null }
})
afterEach(() => {
  Party.reset(1)
  close()
  vi.restoreAllMocks()
})

describe('roulette', () => {
  it('uses the approved formula and locks filters across rerolls', () => {
    expect([0, 1, 2, 3, 4].map(n => rouletteBonus(n, 0) + 150)).toEqual([650, 550, 450, 350, 250])
    const id = queueSong()
    Party.roulette(1, 1, id, 'draw', ['rock', '1980s'])
    const first = state().roulette[0]
    Party.roulette(1, 1, id, 'reroll', [])
    expect(state().roulette[0]).toMatchObject({ filters: ['rock', '1980s'], bonus: 250, rerolls: 1 })
    expect(state().roulette[0].songId).not.toBe(first.songId)
    expect(() => Party.roulette(1, 1, id, 'draw')).toThrow('reroll')
  })
  it('requires ten matches and rejects another singer’s turn', () => {
    const id = queueSong()
    expect(() => Party.roulette(1, 1, id, 'draw', ['missing'])).toThrow('10 songs')
    expect(() => Party.roulette(1, 2, id, 'draw')).toThrow('your singing turns')
  })
  it('pays only on completion and never pays twice', () => {
    setPrefs({ roulette: prefs.roulette })
    const id = queueSong()
    Party.roulette(1, 1, id, 'draw')
    expect(Points.get(1)).toEqual([])
    Party.completed(io, 1, id, false)
    Party.completed(io, 1, id, false)
    expect(Points.get(1)[0].points).toBe(500)
  })
  it('restores the normal selection when declined and forbids free re-entry', () => {
    const id = queueSong(1, 12)
    Party.roulette(1, 1, id, 'draw')
    Party.roulette(1, 1, id, 'decline')
    expect(Queue.get(1).entities[id].songId).toBe(12)
    expect(() => Party.roulette(1, 1, id, 'draw')).toThrow('declined')
  })
  it('does not pay a skip and stops rerolls at zero bonus', () => {
    setPrefs({ roulette: prefs.roulette })
    const id = queueSong()
    Party.roulette(1, 1, id, 'draw', ['rock', '1980s', 'happy', 'classic'])
    Party.roulette(1, 1, id, 'reroll')
    Party.roulette(1, 1, id, 'reroll')
    expect(state().roulette[0].bonus).toBe(0)
    expect(() => Party.roulette(1, 1, id, 'reroll')).toThrow('No bonus')
    Party.completed(io, 1, id, true)
    expect(Points.get(1)).toEqual([])
  })
})

describe('bingo', () => {
  it('deals nine squares with exactly one 500 and no historical progress', () => {
    for (let i = 1; i <= 4; i++) {
      const card = Party.card(1, i)
      expect(card.squares).toHaveLength(9)
      expect(card.squares.filter(s => s.value === 500)).toHaveLength(1)
      expect(card.squares.some(s => s.done)).toBe(false)
    }
  })
  it('excludes disabled games from new cards', () => {
    setPrefs({ bingo: prefs.bingo })
    expect(Party.card(1, 1).squares.every(s => ['song', 'tag', 'artist', 'title'].includes(s.kind))).toBe(true)
  })
  it('pays the lowest simultaneous line once and waits for manual dismissal', () => {
    const squares: BingoSquare[] = Array.from({ length: 9 }, (_, i) => ({ label: 'Hear rock', kind: 'tag', match: 'rock', done: false, value: i === 8 ? 500 : 100 }))
    const card: BingoCard = { id: 'test', squares, payout: 0, lines: [] }
    Party.write(1, 'bingo:1', card)
    Party.event(1, 'song', undefined, Party.songs()[0])
    expect(state().bingo?.payout).toBe(300)
    expect(state().bingo?.lines).toHaveLength(8)
    Party.event(1, 'song', undefined, Party.songs()[0])
    expect(Points.get(1)[0].points).toBe(300)
    expect(Party.card(1, 1).id).toBe('test')
    Party.dismiss(1, 1, 'test')
    expect(Party.card(1, 1).squares.every(s => !s.done)).toBe(true)
    expect(() => Party.dismiss(1, 1, 'test')).toThrow()
  })
  it('matches room songs for everyone but personal objectives for their owner only', () => {
    for (const id of [1, 2]) {
      const card = Party.card(1, id)
      card.squares[0] = { label: 'Correct', kind: 'triviaCorrect', value: 100, done: false }
      card.squares[1] = { label: 'Rock', kind: 'tag', match: 'rock', value: 100, done: false }
      Party.write(1, `bingo:${id}`, card)
    }
    Party.event(1, 'triviaCorrect', 1)
    expect(state(1).bingo?.squares[0].done).toBe(true)
    expect(state(2).bingo?.squares[0].done).toBe(false)
    Party.event(1, 'song', undefined, Party.songs()[0])
    expect(state(2).bingo?.squares[1].done).toBe(true)
  })
  it('evaluates roulette and song squares together before choosing the lowest line', () => {
    const id = queueSong()
    Party.roulette(1, 1, id, 'draw')
    const squares: BingoSquare[] = Array.from({ length: 9 }, (_, i) => ({
      label: 'Test square', kind: i < 3 ? 'tag' : i < 6 ? 'roulette' : 'triviaWin',
      match: i < 3 ? 'rock' : undefined, done: false, value: i < 3 ? 400 : i === 8 ? 500 : 100,
    }))
    Party.write(1, 'bingo:1', { id: 'combined', squares, payout: 0, lines: [] })
    Party.completed(io, 1, id, false)
    expect(state().bingo?.payout).toBe(300)
    expect(Points.get(1)[0].points).toBe(800)
  })

  it('recognizes both diagonals', () => {
    const squares = Array.from({ length: 9 }, (_, i) => ({ label: '', kind: 'song' as const, value: 100, done: [0, 2, 4, 6, 8].includes(i) }))
    expect(bingoWin(squares).lines).toEqual([[0, 4, 8], [2, 4, 6]])
  })
})

describe('Name That Karaoke and Spot Trivia', () => {
  const start = async (kind: 'name' | 'spot' = 'name') => {
    const id = Queue.addParty(1, kind)
    expect(await Party.start(io, 1, id)).toBe(true)
    return id
  }
  const correct = () => {
    const round = Party.state(1, 1, true).round!
    const song = db.get<{ songId: number }>('SELECT songId FROM media WHERE mediaId = ?', [round.mediaId])!
    return round.options.indexOf(`Artist - Song ${song.songId}`)
  }
  it('hides the track from phones, locks answers, and pays three places', async () => {
    await start()
    const round = state().round!
    expect(round.mediaId).toBeUndefined()
    expect(round.correctIdx).toBeUndefined()
    const index = correct()
    Party.answer(io, 1, 1, round.id, index)
    expect(() => Party.answer(io, 1, 1, round.id, index)).toThrow('locked')
    Party.answer(io, 1, 2, round.id, index)
    expect(state().round?.closed).toBe(false)
    Party.answer(io, 1, 3, round.id, index)
    expect(state().round?.closed).toBe(true)
    expect(state().round?.winners.map(w => w.points)).toEqual([500, 250, 100])
    expect(() => Party.answer(io, 1, 4, round.id, index)).toThrow('ended')
  })
  it('waits for every unanswered player when fewer than three are correct', async () => {
    await start()
    const round = state().round!
    const wrong = (correct() + 1) % round.options.length
    for (const id of [1, 2, 3]) Party.answer(io, 1, id, round.id, wrong)
    expect(state().round?.closed).toBe(false)
    Party.answer(io, 1, 4, round.id, wrong)
    expect(state().round?.closed).toBe(true)
    expect(state().round?.winners).toEqual([])
  })
  it('requires three participants and removes a queued round below that minimum', async () => {
    const id = Queue.addParty(1, 'name')
    sockets.delete(3)
    sockets.delete(4)
    expect(await Party.start(io, 1, id)).toBe(false)
    Party.sync(io, 1)
    expect(Queue.get(1).entities[id]).toBeUndefined()
  })
  it('excludes songs already sung tonight', async () => {
    Party.write(1, 'sung', Array.from({ length: 11 }, (_, i) => i + 1))
    await start()
    const round = Party.state(1, 1, true).round!
    expect(db.get<{ songId: number }>('SELECT songId FROM media WHERE mediaId = ?', [round.mediaId]).songId).toBe(12)
  })
  it('can run another round and handles duplicate start requests', async () => {
    const first = await start()
    expect(await Party.start(io, 1, first)).toBe(true)
    Party.finish(io, 1)
    const second = await start()
    expect(second).not.toBe(first)
    expect(state().round?.closed).toBe(false)
  })
  it('runs exactly one Spot Trivia question', async () => {
    await start('spot')
    const round = state().round!
    expect(round.options).toHaveLength(4)
    for (const id of [1, 2, 3, 4]) Party.answer(io, 1, id, round.id, round.options.indexOf('Queen'))
    expect(state().round?.closed).toBe(true)
    expect(state().round?.winners).toHaveLength(4)
  })
  it('refuses client attempts to control playback', async () => {
    const sock = { user: { roomId: 1, userId: 1, isAdmin: false }, server: io }
    await expect(handlers[PARTY_REQUEST](sock, { payload: { operation: 'start', queueId: 1 } }, vi.fn())).rejects.toThrow('Only the room player')
  })
})

describe('room game insertion', () => {
  const pending = () => Object.values(Queue.get(1).entities).filter(item => ['spot', 'name'].includes(item.type) && !item.isPlayed)

  it('uses the trivia rotation schedule and alternates only after a game starts', async () => {
    queueSong()
    vi.spyOn(Rooms, 'isPlayerPlaying').mockReturnValue(false)
    expect(Party.syncQueue(io, 1)).toBe(false)
    vi.mocked(Rooms.isPlayerPlaying).mockReturnValue(true)
    expect(Party.syncQueue(io, 1)).toBe(true)
    expect(pending().map(item => item.type)).toEqual(['spot'])
    const first = pending()[0].queueId
    Party.syncQueue(io, 1)
    expect(pending().map(item => item.queueId)).toEqual([first])
    await Party.start(io, 1, first)
    Party.syncQueue(io, 1)
    expect(pending()).toEqual([])
    Party.finish(io, 1)
    expect(pending().map(item => item.type)).toEqual(['name'])
    await Party.start(io, 1, pending()[0].queueId)
    Party.finish(io, 1)
    expect(pending().map(item => item.type)).toEqual(['spot'])
  })

  it('retires old full rounds even with the old trivia preference enabled', () => {
    setPrefs({ ...prefs, trivia: { isEnabled: true } })
    const old = Queue.addTrivia(1)
    queueSong()
    vi.spyOn(Rooms, 'isPlayerPlaying').mockReturnValue(true)
    Party.syncQueue(io, 1)
    expect(Queue.get(1).entities[old]).toBeUndefined()
    expect(pending().map(item => item.type)).toEqual(['spot'])
  })

  it('does not insert another game when all singing turns are spent', () => {
    const song = queueSong()
    vi.spyOn(Rooms, 'isPlayerPlaying').mockReturnValue(true)
    vi.spyOn(Rooms, 'getPlayerHistory').mockReturnValue([song])
    expect(Party.syncQueue(io, 1)).toBe(false)
    expect(pending()).toEqual([])
  })

  it('falls back to Spot Trivia when Name That Karaoke is unavailable', () => {
    queueSong()
    vi.spyOn(Rooms, 'isPlayerPlaying').mockReturnValue(true)
    Party.write(1, 'lastInterlude', 'spot')
    sockets.delete(3)
    sockets.delete(4)
    Party.syncQueue(io, 1)
    expect(pending().map(item => item.type)).toEqual(['spot'])
  })

  it('removes games when both switches are disabled', () => {
    queueSong()
    vi.spyOn(Rooms, 'isPlayerPlaying').mockReturnValue(true)
    Party.syncQueue(io, 1)
    setPrefs({})
    Party.syncQueue(io, 1)
    expect(pending()).toEqual([])
  })
})
