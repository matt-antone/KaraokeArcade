import sql from 'sqlate'
import { db } from '../lib/Database.js'
import Rooms from '../Rooms/Rooms.js'
import { POINTS_SONG, type LeaderboardEntry } from '../../shared/types.js'
import { POINTS_PUSH } from '../../shared/actionTypes.js'

/**
 * The night's leaderboard: one running total per player per room.
 *
 * Adding and telling the room are separate on purpose. Trivia adds on every
 * answer but only tells the room when the question closes — a board that moved
 * the instant somebody tapped would give the answer away to everyone watching
 * it.
 */
class Points {
  static add (roomId: number, userId: number, points: number): void {
    if (!points) return

    const query = sql`
      INSERT INTO roomPoints (roomId, userId, points)
      VALUES (${roomId}, ${userId}, ${points})
      ON CONFLICT (roomId, userId) DO UPDATE SET points = points + ${points}
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
    if (row) this.add(roomId, row.userId, POINTS_SONG)
  }

  /** Best first; ties by name so the order holds still between pushes. */
  static get (roomId: number): LeaderboardEntry[] {
    const query = sql`
      SELECT roomPoints.userId, users.name, users.avatarId, points
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
