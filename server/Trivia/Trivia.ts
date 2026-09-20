import sql from 'sqlate'
import { db } from '../lib/Database.js'
import getLogger from '../lib/Log.js'
import Rooms, { STATUSES } from '../Rooms/Rooms.js'
import Queue from '../Queue/Queue.js'
import fetchQuestions, { type TriviaQuestion } from './Questions.js'
import {
  clampTriviaCountdown,
  TRIVIA_ANSWER_COUNT,
  TRIVIA_COUNTDOWN_DEFAULT,
  TRIVIA_QUESTIONS_PER_ROUND,
  type TriviaResult,
  type TriviaRound,
  type TriviaScore,
} from '../../shared/types.js'
import { TRIVIA_ROUND, TRIVIA_RESULT, QUEUE_PUSH } from '../../shared/actionTypes.js'

const log = getLogger('Trivia')

/** How long the right answer stays up, every question. Long enough to read
 *  which one it was and argue about it before the standings land. */
const REVEAL_MS = 6000

/** After every answer, how many got it gets the stage to itself. Sequenced
 *  rather than shown alongside: the answer and the count are two different
 *  things to look at, and together they compete. */
const SCOREBOARD_MS = 3000

/** The last scoreboard is the round's result, not a checkpoint, so it holds
 *  twice as long — long enough to find yourself on it and say something. */
const FINAL_SCOREBOARD_FACTOR = 2

/** One question inside a round: its own id, so an answer can never be applied
 *  to the question after it. */
interface ActiveQuestion {
  roundId: number
  correctIdx: number
  /** Public payload, already shuffled — exactly what the room was sent. */
  round: TriviaRound
  /** userId to the index they chose. One answer each, first one counts. */
  answered: Map<number, number>
}

/** A round: several questions asked back to back on one queue row. */
interface ActiveRound {
  /** The queue row being asked. A round is a turn in the rotation, so it
   *  belongs to a row the whole room can see coming. */
  queueId: number
  questions: TriviaQuestion[]
  /** Index into questions of the one in play, or about to be. */
  index: number
  /** Null between questions, while the answer is on screen. */
  current: ActiveQuestion | null
  timer: ReturnType<typeof setTimeout> | null
}

/** roomId to its round in progress. The server is the only place this can
 *  live: two clients racing must not be able to start two rounds. */
const rounds = new Map<number, ActiveRound>()

/** Rooms whose questions are in flight. A round now begins with a network
 *  call, so `rounds` is empty for as long as that takes and the guard against
 *  starting twice has to cover the gap — two players asking at once, or one
 *  asking twice, would otherwise fetch two rounds and race to be the one the
 *  room sees. */
const starting = new Set<number>()

/** A room's next questions, already on the wire. The promise rather than the
 *  questions: it is stored the moment the fetch starts, so two calls a
 *  millisecond apart cannot both fetch. Held until a round uses it — questions
 *  that came back are five the session token will never hand back again — and
 *  dropped with the room, which is where "held" ends. */
const primed = new Map<number, Promise<TriviaQuestion[]>>()

let nextRoundId = 1

function shuffle<T> (items: T[]): T[] {
  const out = [...items]

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }

  return out
}

class Trivia {
  /** A room's trivia prefs, defaulted. Rooms created before trivia existed
   *  carry no key at all, which reads as off — the right default. */
  static getPrefs (roomId: number): { isEnabled: boolean, countdownSeconds: number } {
    const prefs = Rooms.get(roomId, { status: STATUSES }).entities[roomId]?.prefs?.trivia

    return {
      isEnabled: !!prefs?.isEnabled,
      countdownSeconds: clampTriviaCountdown(prefs?.countdownSeconds ?? TRIVIA_COUNTDOWN_DEFAULT),
    }
  }

  /**
   * Keep the room's queue holding exactly one round that has not been asked
   * yet — one when trivia is on, none when it is off. Safe to call whenever
   * anything that could change the answer changes: it compares and acts.
   *
   * Returns true when the queue actually changed, so the caller knows whether
   * the room needs telling.
   */
  static syncQueue (io, roomId: number): boolean {
    if (this.getPrefs(roomId).isEnabled) {
      // A round on stage is spent the moment it starts, so without this the
      // next caller sees nothing pending and pushes its replacement while the
      // room is still answering the current one — two rounds in the queue from
      // the second anyone hits play.
      if (rounds.has(roomId) || starting.has(roomId)) return false

      // every sync, not only when a new round is due: a room that reconnects
      // carrying spent rounds has to be told they are gone, or it goes on
      // showing them as rounds still to come
      const removed = Queue.removeSpentTrivia(roomId) > 0

      const pending = Queue.getPendingTriviaId(roomId)
      if (pending !== null) return removed

      // nothing to take a turn between: a round on its own in an empty queue
      // would start the moment anyone pressed play. Anything that is not a
      // round counts, not only songs — a battle is a turn somebody sings, and
      // a queue made entirely of battles read as zero songs, so trivia never
      // got queued in a room that was doing nothing but battling.
      //
      // A sung row is never removed or marked (unlike trivia's own datePlayed)
      // — it stays in the table all night so a replay can still find it — so
      // counting the table alone sees every song the room ever played and
      // never reaches zero again. The player's own history is the only place
      // "already sung" is recorded, so that is what has to be excluded here,
      // or a room down to nothing but trivia keeps being handed another round.
      const history = new Set(Rooms.getPlayerHistory(io, roomId))
      const query = sql`SELECT queueId FROM queue WHERE roomId = ${roomId} AND type <> 'trivia'`
      const stillToSing = db.all<{ queueId: number }>(String(query), query.parameters)
        .filter(row => !history.has(row.queueId))
      if (stillToSing.length === 0) return removed

      // and nothing on stage: a round added to an idle room is the first thing
      // the room sees when someone finally presses play, ahead of the singer
      // who has been waiting for it. It goes in when the music does — the
      // player's status handler syncs again the moment playback starts.
      if (!Rooms.isPlayerPlaying(io, roomId)) return removed

      Queue.addTrivia(roomId)
      return true
    }

    if (Queue.getPendingTriviaId(roomId) === null) return false

    Queue.removePendingTrivia(roomId)
    this.stopRoom(roomId)
    return true
  }

  /**
   * Fetch the pending row's questions now, rather than when the player reaches
   * it. The row is queued minutes ahead and the mark's splash covers the gap
   * before a round arrives, so by the time anyone is looking at the stage the
   * questions are in memory and the round starts on the frame it is asked for.
   *
   * Fire and forget: fetchQuestions never throws, and an empty result just
   * means the round fetches its own when it starts, exactly as it used to.
   */
  static prime (roomId: number): void {
    if (primed.has(roomId) || rounds.has(roomId) || starting.has(roomId)) return
    if (Queue.getPendingTriviaId(roomId) === null) return

    primed.set(roomId, fetchQuestions(TRIVIA_QUESTIONS_PER_ROUND))
  }

  /** Sync the queue and tell the room, when there is anything to tell. */
  static syncQueueAndPush (io, roomId: number): void {
    if (this.syncQueue(io, roomId)) {
      io.to(Rooms.prefix(roomId)).emit('action', {
        type: QUEUE_PUSH,
        payload: Queue.get(roomId),
      })
    }

    // after the sync, never before: the sync is what creates the row being
    // primed for
    this.prime(roomId)
  }

  /**
   * Is this queue row's round under way — including between its questions,
   * while an answer is on screen?
   *
   * Distinct from getRound, which is null during a reveal. The player asks
   * this to tell "someone already started this row" from "there is nothing to
   * play here", and those two must never be confused: the first means wait,
   * the second means move on.
   */
  static isRoundInProgress (roomId: number, queueId: number): boolean {
    // a round whose questions are still on the wire counts: the player has to
    // keep waiting rather than be told there is nothing here
    return rounds.get(roomId)?.queueId === queueId || starting.has(roomId)
  }

  /** The question a room is in the middle of, for a client that just joined. */
  static getRound (roomId: number): TriviaRound | null {
    const active = rounds.get(roomId)?.current
    return active && active.round.endsAt > Date.now() ? active.round : null
  }

  /**
   * The player has reached a trivia row: start its round.
   *
   * Idempotent twice over. A second call while a round is running is a no-op,
   * so two clients racing cannot start two rounds; and a queueId that is not
   * the pending round is refused, so a player that reloads and replays its way
   * back through the queue does not ask a round the room already answered.
   */
  static async startRound (io, roomId: number, queueId: number): Promise<TriviaRound | null> {
    if (rounds.has(roomId) || starting.has(roomId)) return null
    if (Queue.getPendingTriviaId(roomId) !== queueId) return null

    starting.add(roomId)

    // primed by the row being queued, or fetched here if that never happened
    const ahead = primed.get(roomId)
    primed.delete(roomId)

    let questions: TriviaQuestion[]

    try {
      questions = await (ahead ?? fetchQuestions(TRIVIA_QUESTIONS_PER_ROUND))
    } finally {
      starting.delete(roomId)
    }

    // The row may have been played, or the room closed, while the questions
    // were on the wire — the guards above were true a network call ago.
    if (rounds.has(roomId) || Queue.getPendingTriviaId(roomId) !== queueId) return null

    // No internet, or OpenTDB said no. Leave the row pending and say nothing:
    // the player skips past it, and the next time it comes round the network
    // may be back. A party mid-song is the wrong place for an error message.
    if (!questions.length) {
      log.verbose('no trivia questions came back; skipping this round')
      return null
    }

    rounds.set(roomId, { queueId, questions, index: -1, current: null, timer: null })

    // asked, so it can never be asked again — this is what a player reload
    // walking back through the queue would otherwise do
    Queue.setTriviaPlayed(queueId)

    // and the room has to be told, or every client keeps a copy of this row
    // that still reads "music round" — a spent round showing as one still to
    // come, next to the one that really is
    io.to(Rooms.prefix(roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(roomId),
    })

    return this.askQuestion(io, roomId)
  }

  /** Put the next question of the round in front of the room. */
  static askQuestion (io, roomId: number): TriviaRound | null {
    const active = rounds.get(roomId)
    if (!active) return null

    // the reveal timer that would have called this; clearing it means asking
    // early (as the tests do) cannot leave a second one armed behind us
    if (active.timer) clearTimeout(active.timer)

    active.index++

    const question = active.questions[active.index]
    if (!question) return null

    const answers = shuffle([question.correctAnswer, ...question.incorrectAnswers])
    const { countdownSeconds } = this.getPrefs(roomId)

    const round: TriviaRound = {
      roundId: nextRoundId++,
      queueId: active.queueId,
      questionNumber: active.index + 1,
      questionCount: active.questions.length,
      question: question.question,
      answers,
      difficulty: question.difficulty,
      endsAt: Date.now() + countdownSeconds * 1000,
      sentAt: Date.now(),
    }

    active.current = {
      roundId: round.roundId,
      correctIdx: answers.indexOf(question.correctAnswer),
      round,
      answered: new Map(),
    }
    active.timer = setTimeout(() => this.closeQuestion(io, roomId), countdownSeconds * 1000)

    io.to(Rooms.prefix(roomId)).emit('action', {
      type: TRIVIA_ROUND,
      payload: round,
    })

    return round
  }

  /**
   * Answering closed on the question in play: tell the room what was right,
   * then either move on to the next question or end the round.
   */
  static closeQuestion (io, roomId: number): void {
    const active = rounds.get(roomId)
    if (!active?.current) return

    if (active.timer) clearTimeout(active.timer)

    const { current } = active
    const isFinal = active.index >= active.questions.length - 1
    const numCorrect = [...current.answered.values()].filter(i => i === current.correctIdx).length

    // Three beats on the last question, two on every other: the answer, then
    // how many got it, then — only at the end, where they mean something —
    // the standings.
    const scoresFrom = Date.now() + REVEAL_MS
    const boardFrom = isFinal ? scoresFrom + SCOREBOARD_MS : null

    const payload: TriviaResult = {
      roundId: current.roundId,
      queueId: active.queueId,
      questionNumber: current.round.questionNumber,
      questionCount: current.round.questionCount,
      isFinal,
      correctIdx: current.correctIdx,
      scores: this.getScores(roomId),
      numCorrect,
      scoresFrom,
      boardFrom,
      endsAt: (boardFrom ?? scoresFrom) + SCOREBOARD_MS * (isFinal ? FINAL_SCOREBOARD_FACTOR : 1),
      sentAt: Date.now(),
    }

    active.current = null

    io.to(Rooms.prefix(roomId)).emit('action', {
      type: TRIVIA_RESULT,
      payload,
    })

    if (isFinal) {
      active.timer = null
      rounds.delete(roomId)

      // and the next round takes its place in the rotation, so there is
      // always exactly one waiting
      this.syncQueueAndPush(io, roomId)
      return
    }

    active.timer = setTimeout(() => this.askQuestion(io, roomId), REVEAL_MS + SCOREBOARD_MS)
  }

  /**
   * End the whole round now, whichever question it is on. Used when the room
   * stops caring — trivia switched off, the room closed — and by the tests to
   * drive a round to its end without waiting out five countdowns.
   */
  static closeRound (io, roomId: number): void {
    const active = rounds.get(roomId)
    if (!active) return

    // jump to the last question so the close is final
    active.index = active.questions.length - 1

    if (active.current) {
      this.closeQuestion(io, roomId)
      return
    }

    if (active.timer) clearTimeout(active.timer)
    rounds.delete(roomId)
    this.syncQueueAndPush(io, roomId)
  }

  /**
   * Record an answer. First one counts — a guest cannot walk their way to the
   * right key — and a round that has closed takes none at all.
   */
  static answer ({ roomId, userId, roundId, answerIdx }: {
    roomId: number
    userId: number
    roundId: number
    answerIdx: number
  }): void {
    const current = rounds.get(roomId)?.current

    // Matched on the question's own id, not the room's: between questions
    // there is nothing open, and a tap that lands during the reveal must not
    // be applied to the question that follows it.
    if (!current || current.roundId !== roundId) throw new Error('That question has closed')
    if (current.answered.has(userId)) throw new Error('You have already answered')

    if (!Number.isInteger(answerIdx) || answerIdx < 0 || answerIdx >= TRIVIA_ANSWER_COUNT) {
      throw new Error('Invalid answer')
    }

    current.answered.set(userId, answerIdx)

    const isCorrect = answerIdx === current.correctIdx
    const query = sql`
      INSERT INTO triviaScores (roomId, userId, score, numAnswered)
      VALUES (${roomId}, ${userId}, ${isCorrect ? 1 : 0}, 1)
      ON CONFLICT (roomId, userId) DO UPDATE SET
        score = score + ${isCorrect ? 1 : 0},
        numAnswered = numAnswered + 1
    `
    db.run(String(query), query.parameters)
  }

  /** Everyone who has answered at least once in this room, best first.
   *  Nobody who has not played appears, which is the whole rule. */
  static getScores (roomId: number): TriviaScore[] {
    const query = sql`
      SELECT triviaScores.userId, users.name, score, numAnswered
      FROM triviaScores
        INNER JOIN users USING(userId)
      WHERE roomId = ${roomId}
      ORDER BY score DESC, numAnswered ASC, users.name ASC
    `
    return db.all<TriviaScore>(String(query), query.parameters)
  }

  static resetScores (roomId: number): void {
    const query = sql`DELETE FROM triviaScores WHERE roomId = ${roomId}`
    db.run(String(query), query.parameters)
  }

  /** Drop a room's round and lap count — it closed, or trivia was turned off
   *  under it. Leaves scores alone; those are reset deliberately. */
  static stopRoom (roomId: number): void {
    const active = rounds.get(roomId)
    if (active?.timer) clearTimeout(active.timer)

    rounds.delete(roomId)
    primed.delete(roomId)
  }
}

export default Trivia
