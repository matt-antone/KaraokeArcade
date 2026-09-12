import path from 'path'
import { db } from '../lib/Database.js'
import sql from 'sqlate'
import { clampKeyChange, QueueItem, QueueItemType } from '../../shared/types.js'

/**
 * One database row, turned into the queue item the clients are sent.
 *
 * Its own function because it is a long run of unrelated normalisations —
 * absent singers, absent songs, the second fighter, the columns that must not
 * go over the wire — and none of it is about the ordering the caller does
 * around it.
 */
/** One row of the queue query, before shapeRow normalises it. Named because
 *  shapeRow takes it and an inline type cannot be shared. */
interface QueueRow {
  queueId: number
  type: QueueItemType
  datePlayed: number | null
  songId: number | null
  userId: number | null
  prevQueueId: number
  keyChange: number
  mediaId: number
  relPath: string
  rgTrackGain: number
  rgTrackPeak: number
  userDisplayName: string
  userDateUpdated: number
  pathId: number
  pathData: string
  opponentSongId: number | null
  opponentUserId: number | null
  opponentMediaId: number | null
  opponentRelPath: string | null
  opponentRgTrackGain: number | null
  opponentRgTrackPeak: number | null
  opponentDisplayName: string | null
  opponentDateUpdated: number | null
  opponentPathId: number | null
  opponentPathData: string | null
}

/** A folder's parsed prefs. Only one key is ever read from them here. */
interface PathPrefs {
  isVideoKeyingEnabled?: boolean
}

function shapeRow (
  row: QueueRow,
  prefsForPath: (pathId: number | null, data: string | null) => PathPrefs | undefined,
  getType: (relPath: string) => string | null,
): QueueItem {
  const pathPrefs = prefsForPath(row.pathId, row.pathData)
  const oppPathPrefs = prefsForPath(row.opponentPathId, row.opponentPathData)
  const item = row as QueueRow & Record<string, unknown>

  item.mediaType = row.type === 'trivia' ? null : getType(row.relPath)
  item.isVideoKeyingEnabled = !!pathPrefs?.isVideoKeyingEnabled

  // a round has no singer and no song; 0 keeps every consumer that filters
  // by userId or looks a song up by songId working without a null check
  item.songId = row.songId ?? 0
  item.userId = row.userId ?? 0

  // Same rule for the second fighter, on every row rather than only on a
  // battle: a consumer that reads opponentUserId without knowing about
  // battles gets 0 and filters the row out, which is what it means.
  item.opponentSongId = row.opponentSongId ?? 0
  item.opponentUserId = row.opponentUserId ?? 0
  item.opponentDisplayName = row.opponentDisplayName ?? ''
  item.opponentDateUpdated = row.opponentDateUpdated ?? 0
  item.opponentMediaId = row.opponentMediaId ?? 0
  item.opponentMediaType = row.type === 'battle' ? getType(row.opponentRelPath as string) : null
  item.opponentIsVideoKeyingEnabled = !!oppPathPrefs?.isVideoKeyingEnabled

  // ponytail: no column behind this, so a battle always plays the
  // opponent's half in the recording's own key. The row already carries
  // one keyChange for the challenger; giving the second singer their own
  // needs a migration, and nobody has asked to transpose half a battle.
  item.opponentKeyChange = 0

  // The player names whoever is up next during the intermission, in the
  // corner panel and in the coming-up line. A round is up next like anyone
  // else, so it is given a name here rather than teaching each of those
  // three places what an absent singer looks like.
  if (row.type === 'trivia') {
    item.userDisplayName = 'Trivia'
    item.isPlayed = row.datePlayed !== null
  }

  delete item.datePlayed

  // don't send over the wire
  delete item.relPath
  delete item.pathData
  delete item.opponentRelPath
  delete item.opponentPathId
  delete item.opponentPathData

  return item as unknown as QueueItem
}

class Queue {
  /**
   * Add a songId to a room's queue
   */
  static add ({ roomId, songId, userId }: { roomId: number, songId: number, userId: number }): void {
    const fields = new Map()
    fields.set('roomId', roomId)
    fields.set('songId', songId)
    fields.set('userId', userId)
    // Siglos's behaviour: a returning singer gets the key they last used for
    // this song rather than the recording's. Nothing to remember on a first
    // request, and the DEFAULT 0 covers that.
    //
    // ponytail: matched on songId, so a scanner rescan that re-mints ids
    // forgets the key. That degrades to the original key, which is safe; if it
    // ever matters, match on the normalized artist/title the way songStars and
    // songHistory already do.
    fields.set('keyChange', sql`COALESCE((
      SELECT keyChange
      FROM queue
      WHERE userId = ${userId} AND songId = ${songId}
      ORDER BY queueId DESC
      LIMIT 1
    ), 0)`)
    fields.set('prevQueueId', sql`(
      SELECT queueId
      FROM queue
      WHERE roomId = ${roomId} AND queueId NOT IN (
        SELECT prevQueueId
        FROM queue
        WHERE prevQueueId IS NOT NULL
      )
    )`)

    const query = sql`
      INSERT INTO queue ${sql.tuple(Array.from(fields.keys()).map(sql.column))}
      VALUES ${sql.tuple(Array.from(fields.values()))}
    `
    const res = db.run(String(query), query.parameters)

    if (res.changes !== 1) {
      throw new Error('Could not add song to queue')
    }
  }

  /**
   * Append a trivia round to a room's queue, unless one is already waiting.
   *
   * Idempotent by design: "there is always exactly one round in the queue" is
   * the rule, and two clients whose actions race must not both append one.
   * The pending round is a real row, so the check is a query rather than a
   * lock — SQLite serialises the writes and the loser sees the winner's row.
   *
   * Returns the queueId of the pending round, new or already there.
   */
  static addTrivia (roomId: number): number {
    const pending = this.getPendingTriviaId(roomId)
    if (pending !== null) return pending

    const query = sql`
      INSERT INTO queue (roomId, type, prevQueueId)
      VALUES (${roomId}, 'trivia', (
        SELECT queueId
        FROM queue
        WHERE roomId = ${roomId} AND queueId NOT IN (
          SELECT prevQueueId
          FROM queue
          WHERE prevQueueId IS NOT NULL
        )
      ))
    `
    const res = db.run(String(query), query.parameters)

    if (res.changes !== 1) throw new Error('Could not add a trivia round to the queue')

    return res.lastID
  }

  /** The round waiting to be asked in this room, or null. */
  static getPendingTriviaId (roomId: number): number | null {
    const query = sql`
      SELECT queueId
      FROM queue
      WHERE roomId = ${roomId} AND type = 'trivia' AND datePlayed IS NULL
      ORDER BY queueId ASC
      LIMIT 1
    `
    return db.get<{ queueId: number }>(String(query), query.parameters)?.queueId ?? null
  }

  /**
   * Delete spent trivia rows, keeping the one played most recently.
   *
   * A round's row is nobody's turn once it is over — it is not a song anyone
   * sang, and leaving it behind means the queue grows a dead "Trivia" entry
   * every lap. The newest one stays because the player may still be standing
   * on it showing the final scoreboard, and pulling the current row out from
   * under it sends the player back to the top of the queue.
   */
  static removeSpentTrivia (roomId: number): number {
    // through remove() rather than a DELETE: prevQueueId is a foreign key onto
    // this same table, so whoever pointed at the row has to be re-pointed
    const query = sql`
      SELECT queueId FROM queue
      WHERE roomId = ${roomId} AND type = 'trivia' AND datePlayed IS NOT NULL
      ORDER BY datePlayed DESC
    `
    const [, ...spent] = db.all<{ queueId: number }>(String(query), query.parameters)

    for (const row of spent) this.remove(row.queueId)

    return spent.length
  }

  /** Mark a round asked, so a player restart does not ask it again. */
  static setTriviaPlayed (queueId: number): void {
    const query = sql`
      UPDATE queue
      SET datePlayed = ${Date.now()}
      WHERE queueId = ${queueId} AND type = 'trivia'
    `
    db.run(String(query), query.parameters)
  }

  /**
   * Drop every round that has not been asked yet — trivia was switched off.
   * Rounds already played stay: they are part of what the room did tonight.
   */
  static removePendingTrivia (roomId: number): void {
    const query = sql`
      SELECT queueId
      FROM queue
      WHERE roomId = ${roomId} AND type = 'trivia' AND datePlayed IS NULL
    `
    for (const row of db.all<{ queueId: number }>(String(query), query.parameters)) {
      this.remove(row.queueId)
    }
  }

  /**
   * Turn the challenger's own upcoming song into the battle they just agreed
   * to, in place.
   *
   * In place, rather than appending: the row keeps its exact slot in the
   * prevQueueId chain, so a battle costs the challenger the turn they already
   * had rather than buying them a second one. That is the deal both fighters
   * agreed to, and it is also the only version that cannot be used to jump the
   * queue — challenge somebody, get a turn, repeat.
   *
   * A single UPDATE rather than a read-then-write: the guard is in the WHERE,
   * so two clients racing on the same row leave exactly one battle behind and
   * the loser gets false back. Guarded on roomId and userId as well as the id
   * so a hand-crafted payload cannot convert a stranger's row in another room,
   * and on type = 'song' so a row that is already a battle or a trivia round
   * is never overwritten.
   *
   * Returns whether it actually converted anything; addBattle is the fallback.
   */
  static setBattle ({ roomId, queueId, challengerUserId, challengerSongId, opponentUserId, opponentSongId }: {
    roomId: number
    queueId: number
    challengerUserId: number
    challengerSongId: number
    opponentUserId: number
    opponentSongId: number
  }): boolean {
    const query = sql`
      UPDATE queue
      SET type = 'battle',
        songId = ${challengerSongId},
        opponentUserId = ${opponentUserId},
        opponentSongId = ${opponentSongId}
      WHERE queueId = ${queueId}
        AND roomId = ${roomId}
        AND userId = ${challengerUserId}
        AND type = 'song'
        AND datePlayed IS NULL
    `
    return db.run(String(query), query.parameters).changes === 1
  }

  /**
   * Append a battle at the tail of a room's queue.
   *
   * The fallback for setBattle finding nothing to convert: the challenger had
   * no song of their own waiting, or the one they offered has since been sung,
   * moved or removed. They still agreed to a battle, so it goes to the back of
   * the queue like any other new turn — the same prevQueueId subselect add()
   * uses, which is "the row nobody points at yet", i.e. the tail.
   */
  static addBattle ({ roomId, challengerUserId, challengerSongId, opponentUserId, opponentSongId }: {
    roomId: number
    challengerUserId: number
    challengerSongId: number
    opponentUserId: number
    opponentSongId: number
  }): number {
    const query = sql`
      INSERT INTO queue (roomId, type, userId, songId, opponentUserId, opponentSongId, prevQueueId)
      VALUES (${roomId}, 'battle', ${challengerUserId}, ${challengerSongId},
        ${opponentUserId}, ${opponentSongId}, (
        SELECT queueId
        FROM queue
        WHERE roomId = ${roomId} AND queueId NOT IN (
          SELECT prevQueueId
          FROM queue
          WHERE prevQueueId IS NOT NULL
        )
      ))
    `
    const res = db.run(String(query), query.parameters)

    if (res.changes !== 1) throw new Error('Could not add a battle to the queue')

    return res.lastID
  }

  /**
   * Get queued items for a given room
   */
  static get (roomId: number): { result: number[], entities: Record<number, QueueItem>, pausedUserIds: number[] } {
    const result: number[] = []
    const entities: Record<number, any> = {}
    const map = new Map()
    const pathData = new Map()
    let curQueueId = null

    // LEFT joins because a trivia round has no singer, no song and no media.
    // The INNER joins used to double as a filter — a song whose media has gone
    // is not playable and must not appear — so that filter is now written out
    // in the WHERE clause rather than lost.
    //
    // The media joins used to be `LEFT JOIN media USING(songId)` plus a bare
    // `MAX(isPreferred)`, leaning on SQLite's rule that bare columns beside a
    // lone MAX() come from the row that produced it. A battle needs a second
    // song resolved on the same row, and a second plain join would have made
    // that MAX() range over the cross product of both songs' media — silently
    // handing back a file belonging to the wrong song. So each side now names
    // its own media row through a correlated subselect and joins on the
    // mediaId that comes back: one row per side, no aggregate, and nothing
    // that depends on which row an aggregate happened to look at last.
    //
    // The subselect's ORDER BY is the pick the old MAX() was reaching for,
    // written down: most preferred first, then the highest-priority folder
    // (`priority ASC` is what Library.get orders by too), then the oldest
    // mediaId so a song with two equal files always resolves to the same one
    // rather than to whatever the query planner scanned last.
    const preferredMedia = (songId: ReturnType<typeof sql>) => sql`(
      SELECT m.mediaId
      FROM media AS m
        INNER JOIN paths AS p USING(pathId)
      WHERE m.songId = ${songId}
      ORDER BY m.isPreferred DESC, p.priority ASC, m.mediaId ASC
      LIMIT 1
    )`

    const query = sql`
      SELECT queue.queueId, queue.type, queue.songId, queue.userId, queue.prevQueueId,
        queue.keyChange, queue.datePlayed, queue.opponentSongId, queue.opponentUserId,
        media.mediaId, media.relPath, media.rgTrackGain, media.rgTrackPeak,
        users.name AS userDisplayName, users.dateUpdated AS userDateUpdated,
        paths.pathId, paths.data AS pathData,
        oppMedia.mediaId AS opponentMediaId, oppMedia.relPath AS opponentRelPath,
        oppMedia.rgTrackGain AS opponentRgTrackGain, oppMedia.rgTrackPeak AS opponentRgTrackPeak,
        oppUsers.name AS opponentDisplayName, oppUsers.dateUpdated AS opponentDateUpdated,
        oppPaths.pathId AS opponentPathId, oppPaths.data AS opponentPathData
      FROM queue
        LEFT JOIN users ON users.userId = queue.userId
        LEFT JOIN media ON media.mediaId = ${preferredMedia(sql`queue.songId`)}
        LEFT JOIN paths ON paths.pathId = media.pathId
        LEFT JOIN users AS oppUsers ON oppUsers.userId = queue.opponentUserId
        LEFT JOIN media AS oppMedia ON oppMedia.mediaId = ${preferredMedia(sql`queue.opponentSongId`)}
        LEFT JOIN paths AS oppPaths ON oppPaths.pathId = oppMedia.pathId
      WHERE queue.roomId = ${roomId}
        AND (
          queue.type = 'trivia'
          OR (queue.type = 'song' AND media.mediaId IS NOT NULL)
          OR (queue.type = 'battle' AND media.mediaId IS NOT NULL AND oppMedia.mediaId IS NOT NULL)
        )
      ORDER BY queue.queueId
    `
    const rows = db.all<QueueRow>(String(query), query.parameters)

    /** A folder's prefs, parsed once per folder rather than once per row. */
    const prefsForPath = (pathId: number | null, data: string | null) => {
      if (pathId === null) return undefined

      if (!pathData.has(pathId)) {
        pathData.set(pathId, JSON.parse(data as string))
      }

      return pathData.get(pathId)?.prefs
    }

    for (const row of rows) {
      entities[row.queueId] = shapeRow(row, prefsForPath, relPath => this.getType(relPath))

      if (row.prevQueueId === null) {
        // found the first item
        result.push(row.queueId)
        curQueueId = row.queueId
      } else {
        // map indexed by prevQueueId
        map.set(row.prevQueueId, row.queueId)
      }
    }

    while (result.length < rows.length) {
      // get the item whose prevQueueId references the current one
      const nextQueueId = entities[map.get(curQueueId)].queueId
      result.push(nextQueueId)
      curQueueId = nextQueueId
    }

    return { result, entities, pausedUserIds: this.getPausedUserIds(roomId) }
  }

  /**
   * Set the key a queue item plays in, in semitones from the recording
   */
  static setKeyChange ({ keyChange, queueId }: { keyChange: number, queueId: number }): void {
    const query = sql`
      UPDATE queue
      SET keyChange = ${clampKeyChange(keyChange)}
      WHERE queueId = ${queueId}
    `
    const res = db.run(String(query), query.parameters)

    if (res.changes !== 1) {
      throw new Error(`Could not set key for queueId: ${queueId}`)
    }
  }

  /**
   * Get userIds whose songs are paused (sitting out) in a given room
   */
  static getPausedUserIds (roomId: number): number[] {
    const query = sql`
      SELECT userId
      FROM queuePauses
      WHERE roomId = ${roomId}
    `
    return db.all<{ userId: number }>(String(query), query.parameters).map(row => row.userId)
  }

  /**
   * Pause (remove from rotation) or resume a user's songs in a room
   */
  static setPaused ({ isPaused, roomId, userId }: { isPaused: boolean, roomId: number, userId: number }): void {
    const query = isPaused
      ? sql`
        INSERT OR IGNORE INTO queuePauses (roomId, userId)
        VALUES (${roomId}, ${userId})
      `
      : sql`
        DELETE FROM queuePauses
        WHERE roomId = ${roomId} AND userId = ${userId}
      `
    db.run(String(query), query.parameters)
  }

  /**
   * Move a queue item
   */
  static move ({ prevQueueId, queueId, roomId }: { prevQueueId: number | null, queueId: number, roomId: number }): void {
    if (queueId === prevQueueId) {
      throw new Error('Invalid prevQueueId')
    }

    if (prevQueueId === -1) prevQueueId = null

    const query = sql`
      UPDATE queue
      SET prevQueueId = CASE
        WHEN queueId = newChild THEN ${queueId}
        WHEN queueId = curChild THEN curParent
        WHEN queueId = ${queueId} THEN ${prevQueueId}
        ELSE queue.prevQueueId
      END
      FROM (SELECT
        (
          SELECT prevQueueId
          FROM queue
          WHERE queueId = ${queueId}
        ) AS curParent,
        (
          SELECT queueId
          FROM queue
          WHERE prevQueueId = ${queueId}
        ) AS curChild,
        (
          SELECT queueId
          FROM queue
          WHERE queueId != ${queueId}
            AND prevQueueId ${prevQueueId === null ? sql`IS NULL` : sql`= ${prevQueueId}`}
            AND roomId = ${roomId}
        ) AS newChild
      )
      WHERE roomId = ${roomId}
    `
    db.run(String(query), query.parameters)
  }

  /**
   * Delete a queue item
   */
  static remove (queueId: number): void {
    db.exec('BEGIN IMMEDIATE')
    db.exec('PRAGMA defer_foreign_keys = ON') // v0.9 betas didn't have prevQueueId DEFERRABLE

    try {
      const deleteQuery = sql`
        DELETE FROM queue
        WHERE queueId = ${queueId}
        RETURNING prevQueueId
      `
      const deletedRow = db.get<{ prevQueueId: number | null }>(String(deleteQuery), deleteQuery.parameters)

      if (deletedRow === undefined) {
        throw new Error(`Could not remove queueId: ${queueId}`)
      }

      // close the gap
      const updateQuery = sql`
        UPDATE queue
        SET prevQueueId = ${deletedRow.prevQueueId}
        WHERE prevQueueId = ${queueId}
      `
      db.run(String(updateQuery), updateQuery.parameters)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }

  /**
   * Empty a room's queue and lift every pause in it, so the room can host a
   * new night without being re-created. prevQueueId is self-referential, so
   * the whole room goes in one statement with foreign keys deferred rather
   * than row by row through remove()
   */
  static clear (roomId: number): void {
    db.exec('BEGIN IMMEDIATE')
    db.exec('PRAGMA defer_foreign_keys = ON')

    try {
      const deleteQueue = sql`
        DELETE FROM queue
        WHERE roomId = ${roomId}
      `
      db.run(String(deleteQueue), deleteQueue.parameters)

      // a pause left over from last night silently keeps a singer out of the
      // rotation, and nothing on screen says why
      const deletePauses = sql`
        DELETE FROM queuePauses
        WHERE roomId = ${roomId}
      `
      db.run(String(deletePauses), deletePauses.parameters)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }

  /**
   * Check if user owns queue item(s)
   *
   * A battle belongs to both fighters. The opponent did not queue the row and
   * their userId is not on it, but it is half theirs — they chose one of the
   * songs and they are singing the other — so they may move it, re-key it or
   * pull out of it. Widened here rather than at the three call sites because
   * this one function is the whole gate on QUEUE_MOVE, QUEUE_SET_KEY and
   * QUEUE_REMOVE; teaching each of them about battles separately is three
   * chances to teach only two.
   */
  static isOwner (userId: number, queueId: number | number[]): boolean {
    const ids = Array.isArray(queueId) ? queueId : [queueId]
    if (ids.length === 0) return false

    const query = sql`
      SELECT COUNT(*) AS count
      FROM queue
      WHERE (userId = ${userId} OR opponentUserId = ${userId})
        AND queueId IN ${sql.tuple(ids)}
    `
    const res = db.get<{ count: number }>(String(query), query.parameters)
    return res.count === ids.length
  }

  /**
   * Get media type from file extension
   */
  static getType (file: string): string {
    return /\.mp4/i.test(path.extname(file)) ? 'mp4' : 'cdg'
  }
}

export default Queue
