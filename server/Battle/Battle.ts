import sql from 'sqlate'
import { db } from '../lib/Database.js'
import getLogger from '../lib/Log.js'
import Rooms, { STATUSES } from '../Rooms/Rooms.js'
import Queue from '../Queue/Queue.js'
import {
  BATTLE_BALLOT_MS,
  BATTLE_INTRO_MS,
  BATTLE_JUDGE_MS,
  BATTLE_JUDGING_DEFAULT,
  BATTLE_METER_MS,
  BATTLE_SING_MS,
  BATTLE_VERSUS_MS,
  BATTLE_WINNER_MS,
  clampBattleScore,
  type BattleInvite,
  type BattleJudging,
  type BattleJudgingPref,
  type BattlePhase,
  type BattleSide,
  type BattleSinger,
  type BattleTurn,
} from '../../shared/types.js'
import {
  BATTLE_INVITE,
  BATTLE_INVITE_CLEAR,
  BATTLE_TURN,
  BATTLE_TURN_CLEAR,
  QUEUE_PUSH,
} from '../../shared/actionTypes.js'

const log = getLogger('Battle')

/** How long each beat holds the stage. Two of them — the singing beats — are
 *  ceilings rather than durations: the song running out ends them early. */
const BEAT_MS: Record<BattlePhase, number> = {
  versus: BATTLE_VERSUS_MS,
  intro1: BATTLE_INTRO_MS,
  sing1: BATTLE_SING_MS,
  intro2: BATTLE_INTRO_MS,
  sing2: BATTLE_SING_MS,
  judge: BATTLE_JUDGE_MS,
  ballot: BATTLE_BALLOT_MS,
  meter1: BATTLE_METER_MS,
  meter2: BATTLE_METER_MS,
  winner: BATTLE_WINNER_MS,
}

/** The beats a battle always runs, in order. The judging beats are spliced in
 *  before the last one — see JUDGING_BEATS. */
const BEATS: BattlePhase[] = ['versus', 'intro1', 'sing1', 'intro2', 'sing2', 'judge', 'winner']

/** What each way of deciding a fight costs in beats.
 *
 *  `crowd` is two, one fighter at a time, because a room cannot shout for two
 *  people at once and a microphone cannot tell them apart if it does. `ballot`
 *  is one: every phone holds both names and answers whenever it is ready.
 *  `none` is the room having asked for a microphone the player has not got —
 *  metering a silent input would hand every battle to whoever the rounding
 *  favoured, so nothing is metered and the verdict is a draw. */
const JUDGING_BEATS: Record<BattleJudging, BattlePhase[]> = {
  ballot: ['ballot'],
  crowd: ['meter1', 'meter2'],
  none: [],
}

/** Everything about a fight that is settled before the first beat and does not
 *  change during it. The per-beat payload is built by spreading this, which is
 *  what keeps every emit a fresh object — see the comment on advance. */
type BattleFighters = Omit<BattleTurn, 'phase' | 'endsAt' | 'sentAt' | 'challengerScore' | 'opponentScore'>

interface ActiveBattle {
  queueId: number
  beats: BattlePhase[]
  /** Index into beats of the one on stage. -1 before the first. */
  index: number
  fighters: BattleFighters
  challengerScore: number
  opponentScore: number
  /** userId to the side they voted for, during a ballot. Keyed by person
   *  rather than by socket so the singer with a phone and a tablet gets one
   *  vote, and so changing your mind replaces your vote instead of adding
   *  one. Discarded with the battle: a ballot is about one fight. */
  votes: Map<number, BattleSide>
  /** The payload the room is currently looking at, for a client that joins
   *  part-way through and for matching an early end to the right beat. */
  turn: BattleTurn | null
  timer: ReturnType<typeof setTimeout> | null
}

/** roomId to the battle it is running. The server owns every beat boundary:
 *  two players in one room reading their own clocks would disagree about when
 *  the challenger's two minutes were up, and the room would see two fights. */
const battles = new Map<number, ActiveBattle>()

/** roomId to the challenge thrown in it and not yet answered, plus the queue
 *  row the challenger offered up when they threw it. One per room — two
 *  negotiations at once would race for the same row and the same stage. */
const invites = new Map<number, { invite: BattleInvite, queueId: number }>()

/**
 * Emit to every socket belonging to these people, and to nobody else.
 *
 * A challenge concerns exactly two phones and the rest of the room has no
 * business seeing it, so this cannot go through io.to(roomPrefix). There is no
 * per-user emit anywhere in this codebase to reuse: Prefs/socket.ts's pushPrefs
 * looks like one and is not — it collects socket ids, calls sock.server.to(id),
 * throws the returned operator away and then broadcasts to the whole server.
 * Rooms/socket.ts is the shape that actually works, and this is it: fetch the
 * room's sockets, then emit through io.to(s.id) for the ones that match.
 *
 * Per socket rather than per person on purpose. One singer routinely has the
 * library open on their phone and the queue open on a tablet, and a challenge
 * that only reached one of them would look like it had been swallowed.
 *
 * The player display is the one socket that is skipped even when it matches.
 * It is signed in as somebody — very often as the host, who is also a singer —
 * and a private negotiation between two people has no business appearing on
 * the television in front of the whole room. _lastPlayerStatus is the only
 * tell there is, the same one Rooms.isPlayerPresent uses.
 */
async function emitToUsers (io, roomId: number, userIds: number[], action): Promise<void> {
  const sockets = await io.in(Rooms.prefix(roomId)).fetchSockets()

  for (const s of sockets) {
    if (s._lastPlayerStatus) continue

    if (s.user && userIds.includes(s.user.userId)) {
      io.to(s.id).emit('action', action)
    }
  }
}

/** A singer as the invite records them, read from the users table rather than
 *  from their JWT: a name or an avatar changed since sign-in is stale in the
 *  token, and the invite is the thing the other fighter is looking at. */
function getSinger (userId: number): BattleSinger | null {
  const query = sql`
    SELECT userId, name, dateUpdated
    FROM users
    WHERE userId = ${userId}
  `
  return db.get<BattleSinger>(String(query), query.parameters) ?? null
}

/** A song, resolved to the artist and title the splash shows, so nothing
 *  downstream has to reach into the library to draw a battle. */
function getSong (songId: number): { songId: number, artist: string, title: string } | null {
  const query = sql`
    SELECT songs.songId, songs.title, artists.name AS artist
    FROM songs
      INNER JOIN artists USING(artistId)
    WHERE songs.songId = ${songId}
  `
  return db.get<{ songId: number, artist: string, title: string }>(String(query), query.parameters) ?? null
}

/**
 * Both fighters and both songs for a queue row, or null if the row is not a
 * runnable battle in this room.
 *
 * One query rather than five lookups because every one of its joins is a way
 * for the row to be unrunnable — a singer deleted, a song lost to a rescan —
 * and a single INNER-joined row that either comes back whole or does not come
 * back at all is the validation.
 */
function getFighters (roomId: number, queueId: number): BattleFighters | null {
  const query = sql`
    SELECT queue.queueId,
      challenger.userId AS challengerUserId,
      challenger.name AS challengerName,
      challenger.dateUpdated AS challengerDateUpdated,
      opponent.userId AS opponentUserId,
      opponent.name AS opponentName,
      opponent.dateUpdated AS opponentDateUpdated,
      challengerSong.songId AS challengerSongId,
      challengerSong.title AS challengerTitle,
      challengerArtist.name AS challengerArtist,
      opponentSong.songId AS opponentSongId,
      opponentSong.title AS opponentTitle,
      opponentArtist.name AS opponentArtist
    FROM queue
      INNER JOIN users AS challenger ON challenger.userId = queue.userId
      INNER JOIN users AS opponent ON opponent.userId = queue.opponentUserId
      INNER JOIN songs AS challengerSong ON challengerSong.songId = queue.songId
      INNER JOIN artists AS challengerArtist USING(artistId)
      INNER JOIN songs AS opponentSong ON opponentSong.songId = queue.opponentSongId
      INNER JOIN artists AS opponentArtist ON opponentArtist.artistId = opponentSong.artistId
    WHERE queue.queueId = ${queueId}
      AND queue.roomId = ${roomId}
      AND queue.type = 'battle'
  `
  const row = db.get<{
    queueId: number
    challengerUserId: number
    challengerName: string
    challengerDateUpdated: number
    opponentUserId: number
    opponentName: string
    opponentDateUpdated: number
    challengerSongId: number
    challengerTitle: string
    challengerArtist: string
    opponentSongId: number
    opponentTitle: string
    opponentArtist: string
  }>(String(query), query.parameters)

  if (!row) return null

  return {
    queueId: row.queueId,
    challengerUserId: row.challengerUserId,
    challengerName: row.challengerName,
    challengerDateUpdated: row.challengerDateUpdated,
    opponentUserId: row.opponentUserId,
    opponentName: row.opponentName,
    opponentDateUpdated: row.opponentDateUpdated,
    challengerSong: {
      songId: row.challengerSongId,
      artist: row.challengerArtist,
      title: row.challengerTitle,
    },
    opponentSong: {
      songId: row.opponentSongId,
      artist: row.opponentArtist,
      title: row.opponentTitle,
    },
    // settled by startTurn, which is the only caller and the only one that
    // knows both what the room asked for and what the player can do
    judging: 'none',
  }
}

class Battle {
  /** A room's battle prefs, defaulted. Rooms created before battles existed
   *  carry no key at all, which reads as off — the right default, the same way
   *  Trivia.getPrefs treats its own. */
  static getPrefs (roomId: number): { isEnabled: boolean, judging: BattleJudgingPref } {
    const prefs = Rooms.get(roomId, { status: STATUSES }).entities[roomId]?.prefs?.battle

    return {
      isEnabled: !!prefs?.isEnabled,
      // anything but the one other legal value reads as the default, which
      // covers every room made before there was a choice to make
      judging: prefs?.judging === 'crowd' ? 'crowd' : BATTLE_JUDGING_DEFAULT,
    }
  }

  /**
   * Everyone in the room who could be challenged, best-name-first.
   *
   * Assembled from live sockets rather than from the users table because the
   * question is "who is here right now", not "who has ever been here" — a
   * challenge thrown at somebody who went home three hours ago sits
   * unanswered until it is cancelled.
   *
   * Three things are dropped. The asking user, who cannot fight themselves.
   * userId 0, which is nobody. And the player display, which holds a socket in
   * the room exactly like a phone does — spotted by _lastPlayerStatus, the
   * same tell Rooms.isPlayerPresent uses, because there is no other one.
   * Deduped by userId on top of that: one person routinely has the library on
   * their phone and the queue on a tablet, and would otherwise be listed twice.
   */
  static async getSingers (io, roomId: number, exceptUserId: number): Promise<BattleSinger[]> {
    const sockets = await io.in(Rooms.prefix(roomId)).fetchSockets()
    const singers = new Map<number, BattleSinger>()

    for (const s of sockets) {
      const userId = s.user?.userId

      if (typeof userId !== 'number' || userId === 0 || userId === exceptUserId) continue
      if (s._lastPlayerStatus) continue
      if (singers.has(userId)) continue

      singers.set(userId, { userId, name: s.user.name, dateUpdated: s.user.dateUpdated })
    }

    return [...singers.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  /** The challenge waiting in this room, for a phone that reconnected in the
   *  middle of one. Null once it is answered either way. */
  static getInvite (roomId: number): BattleInvite | null {
    return invites.get(roomId)?.invite ?? null
  }

  /**
   * Throw a challenge: this person, this song, and the queue row the
   * challenger is putting up as the slot to fight in.
   *
   * The guard and the store are one synchronous stretch with no await between
   * them, which is what makes two clients racing produce one invite rather
   * than two — the second call finds the first already in the map. Everything
   * that could fail is checked before anything is stored, so a refusal leaves
   * the room exactly as it found it.
   *
   * Throws rather than returning null: unlike a beat that quietly fails
   * mid-party, somebody is holding a phone waiting for an answer to this one,
   * and "nothing happened" is the worst of the possible answers.
   */
  static async challenge (io, { roomId, challengerUserId, opponentUserId, songId, queueId }: {
    roomId: number
    challengerUserId: number
    opponentUserId: number
    songId: number
    queueId: number
  }): Promise<BattleInvite> {
    if (!this.getPrefs(roomId).isEnabled) throw new Error('Battles are switched off in this room')
    if (challengerUserId === opponentUserId) throw new Error('You can\'t battle yourself')
    if (invites.has(roomId)) throw new Error('Someone else in this room is being challenged')

    const challenger = getSinger(challengerUserId)
    const opponent = getSinger(opponentUserId)
    const song = getSong(songId)

    if (!challenger || !opponent) throw new Error('That singer has left')
    if (!song) throw new Error('That song is no longer in the library')

    const invite: BattleInvite = {
      challengerUserId: challenger.userId,
      challengerName: challenger.name,
      challengerDateUpdated: challenger.dateUpdated,
      opponentUserId: opponent.userId,
      opponentName: opponent.name,
      opponentDateUpdated: opponent.dateUpdated,
      songId: song.songId,
      artist: song.artist,
      title: song.title,
      isAccepted: false,
    }

    invites.set(roomId, { invite, queueId })

    await emitToUsers(io, roomId, [challengerUserId, opponentUserId], {
      type: BATTLE_INVITE,
      payload: invite,
    })

    return invite
  }

  /**
   * The opponent said yes. Both phones are told again with isAccepted set: the
   * opponent's goes to the library to choose what the challenger sings, and
   * the challenger's says it is waiting for them.
   *
   * Accepting twice is a no-op rather than an error — a double tap on a phone
   * that has not repainted yet is not a mistake worth a red banner.
   */
  static async accept (io, roomId: number, userId: number): Promise<void> {
    const pending = invites.get(roomId)

    if (!pending || pending.invite.opponentUserId !== userId) {
      throw new Error('That challenge is no longer waiting')
    }

    if (pending.invite.isAccepted) return

    // a new object rather than a mutation: the same invite is about to be sent
    // again, and a client holding the previous one has to be able to tell them
    // apart by identity
    pending.invite = { ...pending.invite, isAccepted: true }

    await emitToUsers(io, roomId, [pending.invite.challengerUserId, userId], {
      type: BATTLE_INVITE,
      payload: pending.invite,
    })
  }

  /**
   * Call the challenge off. Either fighter may, at any point before the row
   * exists — declining and backing out are the same operation seen from the
   * two ends, so they are one method with two action types pointing at it.
   */
  static async clearInvite (io, roomId: number, userId: number): Promise<void> {
    const pending = invites.get(roomId)
    if (!pending) return

    const { challengerUserId, opponentUserId } = pending.invite

    if (userId !== challengerUserId && userId !== opponentUserId) {
      throw new Error('That isn\'t your challenge')
    }

    invites.delete(roomId)

    await emitToUsers(io, roomId, [challengerUserId, opponentUserId], {
      type: BATTLE_INVITE_CLEAR,
    })
  }

  /**
   * The opponent has chosen the challenger's song, so both halves are settled
   * and the battle becomes a real queue row.
   *
   * Note which song goes where. songId here is what the CHALLENGER sings, and
   * the opponent just picked it; the invite's songId is what the OPPONENT
   * sings, and the challenger picked that one back at step four. Neither
   * fighter ever chooses their own — filing each song under whoever has to
   * sing it is what keeps "userId sings songId" true for a battle row.
   *
   * The invite is deleted before the row is written, so a double tap finds
   * nothing waiting and throws rather than queueing the fight twice.
   */
  static async pick (io, roomId: number, userId: number, songId: number): Promise<void> {
    const pending = invites.get(roomId)

    if (!pending || !pending.invite.isAccepted || pending.invite.opponentUserId !== userId) {
      throw new Error('That challenge is no longer waiting')
    }

    if (!getSong(songId)) throw new Error('That song is no longer in the library')

    const { challengerUserId, opponentUserId, songId: opponentSongId } = pending.invite
    const { queueId } = pending

    invites.delete(roomId)

    const battle = {
      roomId,
      challengerUserId,
      challengerSongId: songId,
      opponentUserId,
      opponentSongId,
    }

    // In place where the challenger has a turn to spend, appended where they
    // do not — or where the row they offered has since been sung, moved out of
    // the room or removed, which is the same thing from here.
    if (!Queue.setBattle({ ...battle, queueId })) Queue.addBattle(battle)

    await emitToUsers(io, roomId, [challengerUserId, opponentUserId], {
      type: BATTLE_INVITE_CLEAR,
    })

    io.to(Rooms.prefix(roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(roomId),
    })
  }

  /**
   * Is this row's battle under way?
   *
   * Distinct from getTurn for the reason spelled out on
   * Trivia.isRoundInProgress: "somebody already started this row" and "there
   * is nothing to run here" are opposite answers, and the player waits for the
   * first and moves on from the second.
   */
  static isTurnInProgress (roomId: number, queueId: number): boolean {
    return battles.get(roomId)?.queueId === queueId
  }

  /** The beat a room is on, for a client that just joined. */
  static getTurn (roomId: number): BattleTurn | null {
    return battles.get(roomId)?.turn ?? null
  }

  /**
   * The player has reached a battle row: run it.
   *
   * canHearRoom is the player's own answer to "can you hear this room" — it is
   * the machine with the microphone, so it is the only one that knows. It only
   * matters to a room set to crowd scoring, and a no there drops both metering
   * beats rather than running them against silence. A room on the default
   * silent ballot never asks the player for anything.
   *
   * Idempotent: a second call while a battle is running is a no-op, so two
   * players in one room cannot start two. There is deliberately no in-flight
   * lock beside the map the way Trivia has one — Trivia's exists to cover an
   * await on the network, and nothing here does any I/O, so the guard and the
   * store are one uninterruptible stretch of synchronous code.
   *
   * Failure is silence. A row that is not a runnable battle logs and returns
   * null, the player moves on, and the room never sees an error mid-party.
   */
  static startTurn (io, roomId: number, queueId: number, canHearRoom: boolean): BattleTurn | null {
    if (battles.has(roomId)) return null

    const fighters = getFighters(roomId, queueId)

    if (!fighters) {
      log.verbose('queueId %s is not a runnable battle in room %s; skipping it', queueId, roomId)
      return null
    }

    const pref = this.getPrefs(roomId).judging
    const judging: BattleJudging = pref === 'crowd' && !canHearRoom ? 'none' : pref

    battles.set(roomId, {
      queueId,
      beats: [...BEATS.slice(0, -1), ...JUDGING_BEATS[judging], 'winner'],
      index: -1,
      fighters: { ...fighters, judging },
      challengerScore: 0,
      opponentScore: 0,
      votes: new Map(),
      turn: null,
      timer: null,
    })

    return this.advance(io, roomId)
  }

  /**
   * Put the next beat in front of the room, or end the battle if that was the
   * last one.
   *
   * Every beat is a whole new BattleTurn object with its own sentAt rather
   * than an edit of the last one. The clients correct for their own clock
   * drift by caching an offset in a WeakMap keyed on the payload object
   * (src/lib/serverNow.ts), so a reused object silently reuses an offset
   * measured minutes ago and the beat is drawn against the wrong clock.
   */
  static advance (io, roomId: number): BattleTurn | null {
    const active = battles.get(roomId)
    if (!active) return null

    // the timer that would have called this; clearing it means ending a beat
    // early (a song that ran out, or a test driving the sequence) cannot leave
    // a second one armed behind us
    if (active.timer) clearTimeout(active.timer)

    active.index++

    const phase = active.beats[active.index]

    if (!phase) {
      this.stopRoom(roomId)

      io.to(Rooms.prefix(roomId)).emit('action', { type: BATTLE_TURN_CLEAR })
      return null
    }

    const ms = BEAT_MS[phase]

    active.turn = {
      ...active.fighters,
      phase,
      endsAt: Date.now() + ms,
      sentAt: Date.now(),
      challengerScore: active.challengerScore,
      opponentScore: active.opponentScore,
    }
    active.timer = setTimeout(() => this.advance(io, roomId), ms)

    io.to(Rooms.prefix(roomId)).emit('action', {
      type: BATTLE_TURN,
      payload: active.turn,
    })

    return active.turn
  }

  /**
   * A song ran out before its two minutes were up: end that beat now.
   *
   * Matched on both the row and the exact beat, not just the room. The player
   * reports the end of a file it has already stopped playing, which can land a
   * tick after the deadline had moved things on by itself — and applied blind
   * that would skip whatever beat had just started.
   */
  static songEnded (io, roomId: number, queueId: number, side: BattleSide): void {
    const active = battles.get(roomId)
    if (!active || active.queueId !== queueId) return
    if (active.turn?.phase !== (side === 1 ? 'sing1' : 'sing2')) return

    this.advance(io, roomId)
  }

  /**
   * One phone's vote, during the ballot beat.
   *
   * Nothing is emitted. A ballot the room can watch filling is not a ballot —
   * the fighter three votes ahead on the screen collects the undecided, and
   * the room ends up voting for whoever was quickest rather than for whoever
   * sang. The tally rides out on the verdict beat like any other grade, which
   * is also why this needs no re-send race the way score does: the counting is
   * finished before the beat that shows it is built.
   *
   * Silent on a refusal for the same reason score is: this is a tap on a phone
   * in a dark room, and a red banner for a vote that landed a half-second
   * after the beat closed is worse than the vote quietly not counting.
   */
  static vote (roomId: number, queueId: number, userId: number, side: BattleSide): void {
    const active = battles.get(roomId)
    if (!active || active.queueId !== queueId) return
    if (active.turn?.phase !== 'ballot') return

    // Neither fighter votes. They are in the room holding phones like everyone
    // else, and a ballot nobody can see is exactly where voting for yourself
    // would never be caught.
    const { challengerUserId, opponentUserId } = active.fighters
    if (userId === challengerUserId || userId === opponentUserId) return

    active.votes.set(userId, side)

    let challenger = 0
    let opponent = 0

    for (const v of active.votes.values()) {
      if (v === 1) challenger++
      else opponent++
    }

    active.challengerScore = clampBattleScore(challenger)
    active.opponentScore = clampBattleScore(opponent)
  }

  /**
   * Record how loud the room was for one fighter.
   *
   * The beat in play is re-sent carrying the new grade rather than the score
   * being quietly filed for the verdict. The player reports a score as its
   * metering beat finishes, which is the same instant that beat's deadline
   * fires here — so the grade routinely arrives with the next beat already on
   * stage, and a room shown a verdict that still reads 0 has no way to
   * recover. Re-sending costs one payload and closes the race from both ends.
   */
  static score (io, roomId: number, queueId: number, side: BattleSide, score: number): void {
    const active = battles.get(roomId)
    if (!active || active.queueId !== queueId || !active.turn) return

    if (side === 1) active.challengerScore = clampBattleScore(score)
    else active.opponentScore = clampBattleScore(score)

    active.turn = {
      ...active.turn,
      sentAt: Date.now(),
      challengerScore: active.challengerScore,
      opponentScore: active.opponentScore,
    }

    io.to(Rooms.prefix(roomId)).emit('action', {
      type: BATTLE_TURN,
      payload: active.turn,
    })
  }

  /**
   * Drop a room's battle and its pending challenge, timers and all.
   *
   * Deliberately silent — the callers are the room being stopped and the room
   * being deleted, and by then there is nobody left to emit to. A timer that
   * outlives its room is not a leak here, it is a bug that was actually hit:
   * it fires against a queue that has just been emptied and pushes a beat into
   * a room that no longer exists.
   */
  static stopRoom (roomId: number): void {
    const active = battles.get(roomId)
    if (active?.timer) clearTimeout(active.timer)

    battles.delete(roomId)
    invites.delete(roomId)
  }
}

export default Battle
