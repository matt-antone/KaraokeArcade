import sql from 'sqlate'
import { db } from '../lib/Database.js'
import Rooms from '../Rooms/Rooms.js'
import { POINTS_SONG, type LeaderboardEntry } from '../../shared/types.js'
import { POINTS_PUSH } from '../../shared/actionTypes.js'

/** What a payment was for, which decides the ledger column it counts toward
 *  (023): a song, a battle won, a battle lost or drawn, or a trivia answer. */
type PointsKind = 'sing' | 'battleWin' | 'battlePlay' | 'trivia'

type Ledger = Pick<LeaderboardEntry, 'points' | 'sings' | 'battleWins' | 'battlePlays' | 'triviaPoints' | 'triviaRounds'>

/**
 * The night's leaderboard: one running total per player per room, plus where
 * it came from.
 *
 * Adding and telling the room are separate on purpose. Trivia adds on every
 * answer but only tells the room when the question closes — a board that moved
 * the instant somebody tapped would give the answer away to everyone watching
 * it.
 */
class Points {
  /** Pay a player. Every kind but trivia counts one event; trivia's column is
   *  the points it paid, because a round is counted separately (addTriviaRound). */
  static add (roomId: number, userId: number, points: number, kind: PointsKind): void {
    if (!points) return

    this.bump(roomId, userId, {
      points,
      sings: Number(kind === 'sing'),
      battleWins: Number(kind === 'battleWin'),
      battlePlays: Number(kind === 'battlePlay'),
      triviaPoints: kind === 'trivia' ? points : 0,
    })
  }

  /** One more trivia round played, whatever it paid. */
  static addTriviaRound (roomId: number, userId: number): void {
    this.bump(roomId, userId, { triviaRounds: 1 })
  }

  /** Put somebody on tonight's board at 0 as they join, so the board is the
   *  room and not only the people who have scored. True when that was news. */
  static join (roomId: number, userId: number): boolean {
    // Selected rather than VALUES, for the reason on bump: this runs in the
    // socket's connect handler, where a throw takes the server down
    const query = sql`
      INSERT INTO roomPoints (roomId, userId, points)
      SELECT rooms.roomId, users.userId, 0 FROM rooms, users
      WHERE rooms.roomId = ${roomId} AND users.userId = ${userId}
      ON CONFLICT (roomId, userId) DO NOTHING
    `
    return db.run(String(query), query.parameters).changes > 0
  }

  /** Selected from rooms and users rather than VALUES: a session outlives its
   *  room or its account (neither delete revokes the JWT), and the foreign
   *  key would throw from a socket's connect or a battle's timer, where
   *  nothing catches it. A payment to nobody is nothing. */
  private static bump (roomId: number, userId: number, {
    points = 0, sings = 0, battleWins = 0, battlePlays = 0, triviaPoints = 0, triviaRounds = 0,
  }: Partial<Ledger>): void {
    const query = sql`
      INSERT INTO roomPoints (roomId, userId, points, sings, battleWins, battlePlays, triviaPoints, triviaRounds)
      SELECT rooms.roomId, users.userId, ${points}, ${sings}, ${battleWins}, ${battlePlays}, ${triviaPoints}, ${triviaRounds}
      FROM rooms, users
      WHERE rooms.roomId = ${roomId} AND users.userId = ${userId}
      ON CONFLICT (roomId, userId) DO UPDATE SET
        points = points + excluded.points,
        sings = sings + excluded.sings,
        battleWins = battleWins + excluded.battleWins,
        battlePlays = battlePlays + excluded.battlePlays,
        triviaPoints = triviaPoints + excluded.triviaPoints,
        triviaRounds = triviaRounds + excluded.triviaRounds
    `
    db.run(String(query), query.parameters)
  }

  /** A song sung to its end. Ordinary song rows only: a battle pays in battle
   *  points and a trivia row is nobody's song. */
  static addSong (roomId: number, queueId: number): void {
    const query = sql`
      SELECT userId FROM queue
      WHERE queueId = ${queueId} AND roomId = ${roomId} AND type = 'song'
    `
    const row = db.get<{ userId: number }>(String(query), query.parameters)
    if (row) this.add(roomId, row.userId, POINTS_SONG, 'sing')
  }

  /** Best first; ties by name so the order holds still between pushes. */
  static get (roomId: number): LeaderboardEntry[] {
    const query = sql`
      SELECT roomPoints.userId, users.name, users.avatarId, points,
        sings, battleWins, battlePlays, triviaPoints, triviaRounds
      FROM roomPoints
        INNER JOIN users USING(userId)
      WHERE roomId = ${roomId}
      ORDER BY points DESC, users.name ASC
    `
    return db.all<LeaderboardEntry>(String(query), query.parameters)
  }

  /** Tell the room (or one socket, by id) where everyone stands. */
  static push (io, roomId: number, to = Rooms.prefix(roomId)): void {
    io.to(to).emit('action', { type: POINTS_PUSH, payload: this.get(roomId) })
  }

  static reset (roomId: number): void {
    const query = sql`DELETE FROM roomPoints WHERE roomId = ${roomId}`
    db.run(String(query), query.parameters)
  }
}

export default Points
