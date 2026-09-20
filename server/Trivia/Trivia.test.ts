import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db, open, close } from '../lib/Database.js'
import Trivia from './Trivia.js'
import fetchQuestions, { type TriviaQuestion } from './Questions.js'
import Queue from '../Queue/Queue.js'
import { QUEUE_PUSH, TRIVIA_RESULT, TRIVIA_ROUND } from '../../shared/actionTypes.js'
import { TRIVIA_QUESTIONS_PER_ROUND, type TriviaResult, type TriviaRound } from '../../shared/types.js'

// A round's questions come off the network now, so the network is the seam:
// the pool below stands in for whatever OpenTDB would have answered.
vi.mock('./Questions.js', () => ({ default: vi.fn() }))

const ROOM_ID = 1
const ALICE = 1
const BOB = 2
const CAROL = 3

interface Emitted { type: string, payload: TriviaRound | TriviaResult | unknown }

/** Enough of socket.io's server to see what the room was told, with a player
 *  in the room that is playing — a round is only queued while one is. */
function fakeIo ({ isPlaying = true, historyJSON = '[]' } = {}) {
  const emitted: Emitted[] = []
  const sockets = new Map([['p', { user: { roomId: ROOM_ID }, _lastPlayerStatus: { isPlaying, historyJSON } }]])

  return {
    emitted,
    to: () => ({ emit: (_e: string, action: Emitted) => emitted.push(action) }),
    of: () => ({ sockets }),
  }
}

/** For the many calls that only care that the room is playing. */
const playerIo = fakeIo()

const user = (userId: number, name: string) =>
  db.run(`INSERT INTO users (userId, username, password, name, roleId)
    VALUES (?, ?, 'x', ?, (SELECT roleId FROM roles WHERE name = 'standard'))`, [userId, name.toLowerCase(), name])

const setTriviaPrefs = (prefs: object) =>
  db.run('UPDATE rooms SET data = ? WHERE roomId = ?', [JSON.stringify({ prefs: { trivia: prefs } }), ROOM_ID])

/** What the next fetch will answer with. */
let pool: TriviaQuestion[] = []

const addQuestion = (question: string, correct = 'right') =>
  pool.push({ question, correctAnswer: correct, incorrectAnswers: ['w1', 'w2', 'w3'], difficulty: 'easy' })

const triviaRowCount = () => db.all<{ n: number }>(
  'SELECT COUNT(*) AS n FROM queue WHERE roomId = ? AND type = \'trivia\'', [ROOM_ID])[0].n

/** Queue a song so the room has singers to derive a lap length from. */
const queueSong = (userId: number) =>
  db.run('INSERT INTO queue (roomId, songId, userId) VALUES (?, 10, ?)', [ROOM_ID, userId])

/** A fresh in-memory database holding one open room with trivia on, three
 *  users and one question waiting on the wire. Module state outlives the
 *  database between tests, so the round is cleared here too. */
function setupRoom () {
  close()
  open({ file: ':memory:', ro: false })

  db.run('INSERT INTO rooms (roomId, name, status) VALUES (?, ?, ?)', [ROOM_ID, 'Room', 'play'])
  user(ALICE, 'Alice')
  user(BOB, 'Bob')
  user(CAROL, 'Carol')
  db.run('INSERT INTO artists (artistId, name, nameNorm) VALUES (1, ?, ?)', ['Eurythmics', 'eurythmics'])
  db.run('INSERT INTO songs (songId, artistId, title, titleNorm) VALUES (10, 1, ?, ?)', ['Sweet Dreams', 'sweet dreams'])
  db.run('INSERT INTO paths (pathId, path, priority, data) VALUES (1, ?, 1, ?)', ['/media', '{}'])
  db.run('INSERT INTO media (mediaId, songId, pathId, relPath, duration, isPreferred) VALUES (100, 10, 1, ?, 60, 1)', ['a.mp4'])

  setTriviaPrefs({ isEnabled: true, countdownSeconds: 20 })

  pool = []
  addQuestion('Who?')
  // fewer than asked for is a short round, which is a round: the room gets
  // whatever the network had
  vi.mocked(fetchQuestions).mockImplementation(async count => pool.slice(0, count))
  vi.mocked(fetchQuestions).mockClear()

  Trivia.stopRoom(ROOM_ID)
}

function teardownRoom () {
  Trivia.stopRoom(ROOM_ID)
  close()
}

describe('trivia rounds', () => {
  beforeEach(setupRoom)
  afterEach(teardownRoom)

  it('stays out of the way while trivia is off', async () => {
    setTriviaPrefs({ isEnabled: false })
    queueSong(ALICE)

    expect(Trivia.syncQueue(playerIo, ROOM_ID)).toBe(false)
    expect(Queue.getPendingTriviaId(ROOM_ID)).toBeNull()
  })

  it('puts a round in the queue once the room has something to sing', async () => {
    // nothing to take a turn between yet
    expect(Trivia.syncQueue(playerIo, ROOM_ID)).toBe(false)
    expect(Queue.getPendingTriviaId(ROOM_ID)).toBeNull()

    queueSong(ALICE)
    expect(Trivia.syncQueue(playerIo, ROOM_ID)).toBe(true)
    expect(Queue.getPendingTriviaId(ROOM_ID)).not.toBeNull()
  })

  /** The questions are fetched when the row is queued, minutes before anyone
   *  reaches it, so the round starts on the frame it is asked for rather than
   *  on whenever OpenTDB answers. */
  it('fetches the round ahead of the row, and starts without fetching again', async () => {
    queueSong(ALICE)
    Trivia.syncQueueAndPush(playerIo, ROOM_ID)

    expect(fetchQuestions).toHaveBeenCalledTimes(1)

    const queueId = Queue.getPendingTriviaId(ROOM_ID)
    const round = await Trivia.startRound(playerIo, ROOM_ID, queueId as number)

    expect(round?.question).toBe('Who?')
    expect(fetchQuestions).toHaveBeenCalledTimes(1)
  })

  it('waits for the player to be playing before adding a round', async () => {
    queueSong(ALICE)

    // a room with the player open but nothing on stage gets nothing: the round
    // would be sitting at the front of the queue when the music finally starts
    expect(Trivia.syncQueue(fakeIo({ isPlaying: false }), ROOM_ID)).toBe(false)
    expect(Queue.getPendingTriviaId(ROOM_ID)).toBeNull()

    expect(Trivia.syncQueue(playerIo, ROOM_ID)).toBe(true)
    expect(Queue.getPendingTriviaId(ROOM_ID)).not.toBeNull()
  })

  it('keeps exactly one round waiting, however many callers ask', async () => {
    queueSong(ALICE)

    const first = Trivia.syncQueue(playerIo, ROOM_ID)
    const pending = Queue.getPendingTriviaId(ROOM_ID)

    expect(first).toBe(true)
    expect(Trivia.syncQueue(playerIo, ROOM_ID)).toBe(false)
    expect(Trivia.syncQueue(playerIo, ROOM_ID)).toBe(false)
    expect(Queue.addTrivia(ROOM_ID)).toBe(pending)

    const rows = db.all<{ n: number }>(
      'SELECT COUNT(*) AS n FROM queue WHERE roomId = ? AND type = \'trivia\'', [ROOM_ID])
    expect(rows[0].n).toBe(1)
  })

  it('takes the waiting round back out when trivia is switched off', async () => {
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)

    setTriviaPrefs({ isEnabled: false })
    expect(Trivia.syncQueue(playerIo, ROOM_ID)).toBe(true)
    expect(Queue.getPendingTriviaId(ROOM_ID)).toBeNull()
    // the singer's song is untouched
    expect(Queue.get(ROOM_ID).result).toHaveLength(1)
  })

  it('leaves a round that was already played in the queue when switched off', async () => {
    queueSong(ALICE)
    const pending = Trivia.syncQueue(playerIo, ROOM_ID) && Queue.getPendingTriviaId(ROOM_ID)!
    await Trivia.startRound(fakeIo(), ROOM_ID, pending as number)

    setTriviaPrefs({ isEnabled: false })
    Trivia.syncQueue(playerIo, ROOM_ID)

    // it is part of what the room did tonight, not a pending obligation
    expect(Queue.get(ROOM_ID).result).toContain(pending)
  })

  it('shows the round in the queue with no singer and no song', async () => {
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)

    const { result, entities } = Queue.get(ROOM_ID)
    const trivia = result.map(id => entities[id]).find(e => e.type === 'trivia')!

    expect(trivia).toBeDefined()
    expect(trivia.userId).toBe(0)
    expect(trivia.songId).toBe(0)
    expect(trivia.mediaType).toBeNull()
    expect(trivia.userDisplayName).toBe('Trivia')
    // and it sits behind the song that was queued before it
    expect(result.indexOf(trivia.queueId)).toBe(1)
  })

  it('still hides a song whose media has gone, now the join is a LEFT one', async () => {
    queueSong(ALICE)
    db.run('INSERT INTO songs (songId, artistId, title, titleNorm) VALUES (11, 1, ?, ?)', ['No Media', 'no media'])
    db.run('INSERT INTO queue (roomId, songId, userId, prevQueueId) VALUES (?, 11, ?, ?)',
      [ROOM_ID, ALICE, Queue.get(ROOM_ID).result.at(-1)])

    // the unplayable row is not in the queue the room is shown
    expect(Queue.get(ROOM_ID).result).toHaveLength(1)
  })

  it('asks the round on the row the player has reached', async () => {
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!

    const io = fakeIo()
    const round = await Trivia.startRound(io, ROOM_ID, queueId)

    expect(round?.queueId).toBe(queueId)
    expect(io.emitted.map(e => e.type)).toContain(TRIVIA_ROUND)
  })

  it('refuses to ask a row that is not the one waiting', async () => {
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!

    const io = fakeIo()
    expect(await Trivia.startRound(io, ROOM_ID, queueId + 999)).toBeNull()
    expect(io.emitted).toEqual([])
  })

  it('never asks the same row twice, however the player gets back to it', async () => {
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!

    expect(await Trivia.startRound(fakeIo(), ROOM_ID, queueId)).not.toBeNull()
    Trivia.closeRound(fakeIo(), ROOM_ID)

    // a player that reloads and replays its way back must not re-ask it
    expect(await Trivia.startRound(fakeIo(), ROOM_ID, queueId)).toBeNull()
  })

  it('keeps one round in the queue while another is on stage', async () => {
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!

    await Trivia.startRound(fakeIo(), ROOM_ID, queueId)

    // the row is spent the moment the round starts; its replacement waits for
    // the round to finish rather than joining it in the queue
    expect(Trivia.syncQueue(playerIo, ROOM_ID)).toBe(false)
    expect(triviaRowCount()).toBe(1)

    Trivia.closeRound(fakeIo(), ROOM_ID)
    expect(triviaRowCount()).toBe(2)
  })

  it('tells the room the round is spent the moment it starts', async () => {
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!

    const io = fakeIo()
    await Trivia.startRound(io, ROOM_ID, queueId)

    // without this the room holds a copy saying the round is still to come,
    // and shows it next to the one that really is
    const push = io.emitted.find(e => e.type === QUEUE_PUSH)
    expect(push).toBeDefined()
    expect((push!.payload as ReturnType<typeof Queue.get>).entities[queueId].isPlayed).toBe(true)
  })

  it('clears spent rounds a reconnecting room is still carrying', async () => {
    queueSong(ALICE)

    // the shape a party in progress got into: rounds played but never cleared,
    // so every one of them still reads as a round to come
    const spent = (playedAt: number) => db.run(
      'INSERT INTO queue (roomId, type, prevQueueId, datePlayed) VALUES (?, \'trivia\', NULL, ?)',
      [ROOM_ID, playedAt])

    spent(1000)
    spent(2000)
    Trivia.syncQueue(playerIo, ROOM_ID)
    expect(triviaRowCount()).toBe(2) // the newest spent one, plus the new pending one

    // and nothing left to do on the next connect
    expect(Trivia.syncQueue(playerIo, ROOM_ID)).toBe(false)
  })

  it('leaves one spent round behind, not one per lap', async () => {
    queueSong(ALICE)

    for (let lap = 0; lap < 3; lap++) {
      Trivia.syncQueue(playerIo, ROOM_ID)
      await Trivia.startRound(fakeIo(), ROOM_ID, Queue.getPendingTriviaId(ROOM_ID)!)
      Trivia.closeRound(fakeIo(), ROOM_ID)
    }

    // the one just played, which the player may still be standing on, plus
    // the one waiting. Never a lap's worth of dead rows.
    expect(triviaRowCount()).toBe(2)
  })

  it('puts the next round at the back of the queue as one finishes', async () => {
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
    const first = Queue.getPendingTriviaId(ROOM_ID)!

    await Trivia.startRound(fakeIo(), ROOM_ID, first)
    expect(Queue.getPendingTriviaId(ROOM_ID)).toBeNull() // asked, so no longer waiting

    Trivia.closeRound(fakeIo(), ROOM_ID)

    const next = Queue.getPendingTriviaId(ROOM_ID)
    expect(next).not.toBeNull()
    expect(next).not.toBe(first)
  })

  it('stops requeuing once the only song left has actually been sung', async () => {
    const { lastID: songQueueId } = queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!

    // the room's only song has actually been sung — the player says so in its
    // history — so there is nothing left to take a turn between
    const sungIo = fakeIo({ historyJSON: JSON.stringify([songQueueId]) })

    await Trivia.startRound(sungIo, ROOM_ID, queueId)
    Trivia.closeRound(sungIo, ROOM_ID)

    expect(Queue.getPendingTriviaId(ROOM_ID)).toBeNull()
    expect(Trivia.syncQueue(sungIo, ROOM_ID)).toBe(false)
  })

  it('never runs two rounds at once, however many callers ask', async () => {
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!
    const io = fakeIo()

    expect(await Trivia.startRound(io, ROOM_ID, queueId)).not.toBeNull()
    expect(await Trivia.startRound(io, ROOM_ID, queueId)).toBeNull()
    expect(await Trivia.startRound(io, ROOM_ID, queueId)).toBeNull()
    expect(io.emitted.filter(e => e.type === TRIVIA_ROUND)).toHaveLength(1)
  })

  it('sends the room four shuffled answers and no hint of which is right', async () => {
    const round = await startPendingRound()

    expect(round?.answers).toHaveLength(4)
    expect(round?.answers).toEqual(expect.arrayContaining(['right', 'w1', 'w2', 'w3']))
    expect(JSON.stringify(round)).not.toContain('correctIdx')
  })

  it('says nothing at all when the cache is dry, leaving the row to try again', async () => {
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!
    pool = []
    const io = fakeIo()

    expect(await Trivia.startRound(io, ROOM_ID, queueId)).toBeNull()
    expect(io.emitted).toEqual([])
    // still waiting, so a later round can use it once questions arrive
    expect(Queue.getPendingTriviaId(ROOM_ID)).toBe(queueId)
  })

  /** Ask whichever round is waiting, queueing one first if needed. */
  const startPendingRound = async () => {
    if (Queue.getPendingTriviaId(ROOM_ID) === null) {
      queueSong(ALICE)
      Trivia.syncQueue(playerIo, ROOM_ID)
    }
    return await Trivia.startRound(fakeIo(), ROOM_ID, Queue.getPendingTriviaId(ROOM_ID)!)
  }

  /** Play a round through to its close and hand back the question asked. */
  const playRound = async () => {
    const round = await startPendingRound()
    Trivia.closeRound(fakeIo(), ROOM_ID)
    return round
  }

  /** Every question a whole round asks, in order. */
  const collectRound = async (): Promise<string[]> => {
    const first = await startPendingRound()
    if (!first) return []

    const asked = [first.question]

    for (let i = 1; i < first.questionCount; i++) {
      Trivia.closeQuestion(fakeIo(), ROOM_ID)
      const next = Trivia.askQuestion(fakeIo(), ROOM_ID)
      if (next) asked.push(next.question)
    }

    Trivia.closeRound(fakeIo(), ROOM_ID)
    return asked
  }

  it('asks for a whole round of questions, once, each time round', async () => {
    for (let i = 0; i < TRIVIA_QUESTIONS_PER_ROUND * 2; i++) addQuestion(`q${i}`)
    vi.mocked(fetchQuestions).mockClear()

    const first = await collectRound()
    const second = await collectRound()

    expect(first).toHaveLength(TRIVIA_QUESTIONS_PER_ROUND)
    expect(second).toHaveLength(TRIVIA_QUESTIONS_PER_ROUND)

    // one call per round, for the whole round — plus the one standing ahead of
    // the row nobody reached, which is the point of priming. Not asking the
    // same question twice in a night is the session token's job on the other
    // side of this seam, not something the room has to keep a ledger for.
    expect(fetchQuestions).toHaveBeenCalledTimes(3)
    expect(fetchQuestions).toHaveBeenCalledWith(TRIVIA_QUESTIONS_PER_ROUND)
  })

  it('repeats a question rather than letting trivia quietly stop', async () => {
    // the network had one question to give, twice over: a room that has
    // outlasted the category still gets a round
    const first = await playRound()
    const second = await playRound()

    expect(second?.question).toBe(first?.question)
    expect(second?.roundId).not.toBe(first?.roundId)
  })
})

describe('trivia answers and scores', () => {
  let correctIdx: number
  let roundId: number

  beforeEach(async () => {
    setupRoom()

    db.run('INSERT INTO queue (roomId, songId, userId) VALUES (?, 10, ?)', [ROOM_ID, ALICE])
    Trivia.syncQueue(playerIo, ROOM_ID)

    const round = await Trivia.startRound(fakeIo(), ROOM_ID, Queue.getPendingTriviaId(ROOM_ID)!)!
    roundId = round.roundId
    correctIdx = round.answers.indexOf('right')
  })

  afterEach(teardownRoom)

  const answer = (userId: number, answerIdx: number) =>
    Trivia.answer({ roomId: ROOM_ID, userId, roundId, answerIdx })

  it('scores a right answer and still counts a wrong one as played', async () => {
    answer(ALICE, correctIdx)
    answer(BOB, (correctIdx + 1) % 4)

    expect(Trivia.getScores(ROOM_ID)).toEqual([
      { userId: ALICE, name: 'Alice', score: 1, numAnswered: 1 },
      { userId: BOB, name: 'Bob', score: 0, numAnswered: 1 },
    ])
  })

  it('takes the first answer only, so nobody can walk to the right key', async () => {
    answer(ALICE, (correctIdx + 1) % 4)
    expect(() => answer(ALICE, correctIdx)).toThrow(/already answered/)

    expect(Trivia.getScores(ROOM_ID)[0].score).toBe(0)
  })

  it('refuses an answer to a round that has closed', async () => {
    Trivia.closeRound(fakeIo(), ROOM_ID)
    expect(() => answer(ALICE, correctIdx)).toThrow(/closed/)
  })

  it('refuses an answer to some other round', async () => {
    expect(() => Trivia.answer({ roomId: ROOM_ID, userId: ALICE, roundId: roundId + 99, answerIdx: 0 }))
      .toThrow(/closed/)
  })

  it('refuses a key that is not one of the four', async () => {
    expect(() => answer(ALICE, 4)).toThrow(/Invalid answer/)
    expect(() => answer(ALICE, -1)).toThrow(/Invalid answer/)
    expect(Trivia.getScores(ROOM_ID)).toEqual([])
  })

  it('leaves everyone who has not played off the scoreboard', async () => {
    answer(ALICE, correctIdx)

    const scores = Trivia.getScores(ROOM_ID)
    expect(scores).toHaveLength(1)
    expect(scores.map(s => s.name)).not.toContain('Carol')
  })

  it('puts the best first, and the one who got there in fewer goes ahead', async () => {
    answer(ALICE, (correctIdx + 1) % 4)
    answer(BOB, correctIdx)
    answer(CAROL, correctIdx)
    Trivia.closeRound(fakeIo(), ROOM_ID)

    // Carol sits out the second round, so Bob answers twice for the same score
    const second = await Trivia.startRound(fakeIo(), ROOM_ID, Queue.getPendingTriviaId(ROOM_ID)!)!
    Trivia.answer({ roomId: ROOM_ID, userId: BOB, roundId: second.roundId, answerIdx: (second.answers.indexOf('right') + 1) % 4 })

    expect(Trivia.getScores(ROOM_ID).map(s => s.name)).toEqual(['Carol', 'Bob', 'Alice'])
  })

  it('tells the room what was right only once answering has closed', async () => {
    const io = fakeIo()
    answer(ALICE, correctIdx)
    Trivia.closeRound(io, ROOM_ID)

    // the result, and then the queue carrying the next round
    expect(io.emitted.map(e => e.type)).toEqual([TRIVIA_RESULT, QUEUE_PUSH])
    const result = io.emitted[0].payload as TriviaResult
    expect(result.correctIdx).toBe(correctIdx)
    expect(result.scores[0].name).toBe('Alice')
    expect(Trivia.getRound(ROOM_ID)).toBeNull()
  })

  it('closing twice tells the room once', async () => {
    const io = fakeIo()
    Trivia.closeRound(io, ROOM_ID)
    Trivia.closeRound(io, ROOM_ID)

    expect(io.emitted.filter(e => e.type === TRIVIA_RESULT)).toHaveLength(1)
  })

  it('resets the scoreboard without ending the round', async () => {
    answer(ALICE, correctIdx)
    Trivia.resetScores(ROOM_ID)

    expect(Trivia.getScores(ROOM_ID)).toEqual([])
    expect(Trivia.getRound(ROOM_ID)).not.toBeNull()
  })
})

describe('a round of several questions', () => {
  const io = () => fakeIo()

  /** Start the round waiting on the room's pending trivia row. */
  const start = async () => {
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
    return await Trivia.startRound(fakeIo(), ROOM_ID, Queue.getPendingTriviaId(ROOM_ID)!)!
  }

  beforeEach(async () => {
    setupRoom()
    // one is seeded by setupRoom; a full round wants five
    for (const q of ['q2', 'q3', 'q4', 'q5', 'q6']) addQuestion(q)
  })

  afterEach(teardownRoom)

  it('asks five questions on one turn in the rotation', async () => {
    const first = await start()
    expect(first.questionNumber).toBe(1)
    expect(first.questionCount).toBe(TRIVIA_QUESTIONS_PER_ROUND)

    const asked = [first.question]

    for (let i = 2; i <= TRIVIA_QUESTIONS_PER_ROUND; i++) {
      Trivia.closeQuestion(io(), ROOM_ID)
      const next = Trivia.askQuestion(io(), ROOM_ID)!
      expect(next.questionNumber).toBe(i)
      asked.push(next.question)
    }

    // five different questions, and a fresh id for each so an answer can
    // never be applied to the one after it
    expect(new Set(asked).size).toBe(TRIVIA_QUESTIONS_PER_ROUND)
  })

  it('holds the queue row until the last question is done', async () => {
    const first = await start()
    const queueId = first.queueId

    // four reveals in, the row is still the round's and nothing new is waiting
    for (let i = 1; i < TRIVIA_QUESTIONS_PER_ROUND; i++) {
      const emitted = io()
      Trivia.closeQuestion(emitted, ROOM_ID)
      expect((emitted.emitted[0].payload as TriviaResult).isFinal).toBe(false)
      expect(Queue.getPendingTriviaId(ROOM_ID)).toBeNull()
      Trivia.askQuestion(io(), ROOM_ID)
    }

    const last = io()
    Trivia.closeQuestion(last, ROOM_ID)
    expect((last.emitted[0].payload as TriviaResult).isFinal).toBe(true)

    // only now does the next round join the rotation
    const next = Queue.getPendingTriviaId(ROOM_ID)
    expect(next).not.toBeNull()
    expect(next).not.toBe(queueId)
  })

  it('gives everyone a fresh answer on every question', async () => {
    const first = await start()
    Trivia.answer({ roomId: ROOM_ID, userId: ALICE, roundId: first.roundId, answerIdx: first.answers.indexOf('right') })

    Trivia.closeQuestion(io(), ROOM_ID)
    const second = Trivia.askQuestion(io(), ROOM_ID)!

    // answering the first must not lock anyone out of the second
    expect(() => Trivia.answer({ roomId: ROOM_ID, userId: ALICE, roundId: second.roundId, answerIdx: 0 })).not.toThrow()
    expect(Trivia.getScores(ROOM_ID)[0].numAnswered).toBe(2)
  })

  it('refuses an answer aimed at the question just gone', async () => {
    const first = await start()
    Trivia.closeQuestion(io(), ROOM_ID)
    Trivia.askQuestion(io(), ROOM_ID)

    // a tap that lands during the reveal must not score against the next one
    expect(() => Trivia.answer({ roomId: ROOM_ID, userId: ALICE, roundId: first.roundId, answerIdx: 0 }))
      .toThrow(/closed/)
  })

  it('takes nothing at all while the answer is on screen', async () => {
    const first = await start()
    Trivia.closeQuestion(io(), ROOM_ID)

    expect(() => Trivia.answer({ roomId: ROOM_ID, userId: ALICE, roundId: first.roundId, answerIdx: 0 }))
      .toThrow(/closed/)
  })

  it('asks a short round rather than none when few questions come back', async () => {
    pool = pool.slice(0, 1)

    const only = await start()
    expect(only.questionCount).toBe(1)

    const last = io()
    Trivia.closeQuestion(last, ROOM_ID)
    expect((last.emitted[0].payload as TriviaResult).isFinal).toBe(true)
  })

  it('shows the answer first and the scoreboard after it', async () => {
    await start()
    const emitted = io()

    for (let i = 1; i < TRIVIA_QUESTIONS_PER_ROUND; i++) {
      Trivia.closeQuestion(io(), ROOM_ID)
      Trivia.askQuestion(io(), ROOM_ID)
    }

    Trivia.closeQuestion(emitted, ROOM_ID)
    const result = emitted.emitted[0].payload as TriviaResult

    expect(result.isFinal).toBe(true)
    // the answer gets the stage on its own, then hands over to the standings
    expect(result.scoresFrom).toBeGreaterThan(Date.now())
    expect(result.endsAt).toBeGreaterThan(result.scoresFrom)
  })

  it('shows the standings after every question, and holds the last one longer', async () => {
    await start()
    const mid = io()
    Trivia.closeQuestion(mid, ROOM_ID)

    const midResult = mid.emitted[0].payload as TriviaResult
    expect(midResult.isFinal).toBe(false)
    // a checkpoint scoreboard, so there is something to chase into question two
    expect(midResult.endsAt).toBeGreaterThan(midResult.scoresFrom)

    for (let i = 1; i < TRIVIA_QUESTIONS_PER_ROUND - 1; i++) {
      Trivia.askQuestion(io(), ROOM_ID)
      Trivia.closeQuestion(io(), ROOM_ID)
    }

    Trivia.askQuestion(io(), ROOM_ID)
    const last = io()
    Trivia.closeQuestion(last, ROOM_ID)

    const lastResult = last.emitted[0].payload as TriviaResult
    expect(lastResult.isFinal).toBe(true)
    expect(lastResult.endsAt - lastResult.scoresFrom)
      .toBeGreaterThan(midResult.endsAt - midResult.scoresFrom)
  })

  it('ends the whole round when the room stops caring', async () => {
    await start()
    const emitted = io()

    // trivia switched off mid-round: closeRound ends it there and then
    Trivia.closeRound(emitted, ROOM_ID)
    expect((emitted.emitted[0].payload as TriviaResult).isFinal).toBe(true)
    expect(Trivia.getRound(ROOM_ID)).toBeNull()
  })
})

/**
 * The bug this guards: the player asked for its round twice — React's
 * StrictMode double-invokes effects in development — and the second answer
 * said "not started", which the player read as "nothing here, move on". The
 * round then ended after its first question while the server went on
 * broadcasting the other four into a room that had stopped listening.
 */
describe('asking twice for the same round', () => {
  beforeEach(async () => {
    setupRoom()
    for (const q of ['q2', 'q3', 'q4', 'q5', 'q6']) addQuestion(q)
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
  })

  afterEach(teardownRoom)

  it('reports the second ask as in progress, never as unavailable', async () => {
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!

    expect(Trivia.isRoundInProgress(ROOM_ID, queueId)).toBe(false)
    expect(await Trivia.startRound(fakeIo(), ROOM_ID, queueId)).not.toBeNull()

    // the duplicate: a round is running, so the row is emphatically not
    // "nothing to play"
    expect(Trivia.isRoundInProgress(ROOM_ID, queueId)).toBe(true)
    expect(await Trivia.startRound(fakeIo(), ROOM_ID, queueId)).toBeNull()
  })

  it('still reports in progress between questions, while an answer is up', async () => {
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!
    await Trivia.startRound(fakeIo(), ROOM_ID, queueId)
    Trivia.closeQuestion(fakeIo(), ROOM_ID)

    // getRound is null during the reveal, which is why the check cannot be
    // written in terms of it — that gap is where the player would bail
    expect(Trivia.getRound(ROOM_ID)).toBeNull()
    expect(Trivia.isRoundInProgress(ROOM_ID, queueId)).toBe(true)
  })

  it('reports unavailable only once the round has really finished', async () => {
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!
    await Trivia.startRound(fakeIo(), ROOM_ID, queueId)
    Trivia.closeRound(fakeIo(), ROOM_ID)

    expect(Trivia.isRoundInProgress(ROOM_ID, queueId)).toBe(false)
    expect(await Trivia.startRound(fakeIo(), ROOM_ID, queueId)).toBeNull()
  })

  it('reports unavailable for a row that has nothing to ask', async () => {
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!
    pool = []

    expect(Trivia.isRoundInProgress(ROOM_ID, queueId)).toBe(false)
    expect(await Trivia.startRound(fakeIo(), ROOM_ID, queueId)).toBeNull()
  })
})

describe('a room reset while trivia is running', () => {
  beforeEach(async () => {
    setupRoom()
    for (const q of ['q2', 'q3', 'q4', 'q5', 'q6']) addQuestion(q)
    queueSong(ALICE)
    Trivia.syncQueue(playerIo, ROOM_ID)
  })

  afterEach(teardownRoom)

  it('leaves no round running on a queue that has been emptied', async () => {
    const queueId = Queue.getPendingTriviaId(ROOM_ID)!
    await Trivia.startRound(fakeIo(), ROOM_ID, queueId)
    expect(Trivia.isRoundInProgress(ROOM_ID, queueId)).toBe(true)

    // what ROOM_RESET_REQUEST does: empty the queue, then stop the round
    Queue.clear(ROOM_ID)
    Trivia.stopRoom(ROOM_ID)

    expect(Trivia.isRoundInProgress(ROOM_ID, queueId)).toBe(false)
    expect(Trivia.getRound(ROOM_ID)).toBeNull()
  })

  it('puts no round back into a room that was just emptied', async () => {
    Queue.clear(ROOM_ID)
    Trivia.stopRoom(ROOM_ID)

    // nothing to take a turn between, so a reset room stays empty until
    // somebody queues a song
    expect(Trivia.syncQueue(playerIo, ROOM_ID)).toBe(false)
    expect(Queue.getPendingTriviaId(ROOM_ID)).toBeNull()
  })
})
