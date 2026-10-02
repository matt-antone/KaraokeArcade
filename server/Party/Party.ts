import { randomUUID, randomInt } from 'node:crypto'
import { db } from '../lib/Database.js'
import Library from '../Library/Library.js'
import Rooms, { STATUSES } from '../Rooms/Rooms.js'
import Queue from '../Queue/Queue.js'
import Points from '../Points/Points.js'
import { fetchQuestions } from '../Trivia/Questions.js'
import { QUEUE_PUSH } from '../../shared/actionTypes.js'
import { chooseInterlude, bingoWin, emptyParty, matchingSongs, rouletteBonus, PARTY_PUSH, type Interlude, type BingoCard, type BingoSquare, type PartyGame, type PartyRound, type PartyState, type RouletteDraw } from '../../shared/party.js'
import type { Song } from '../../shared/types.js'

const shuffle = <T>(items: T[]) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
interface Active { round: PartyRound, correctIdx: number, songId: number, answers: Record<number, number>, timer?: ReturnType<typeof setTimeout> }
const rounds = new Map<number, Active>()
const starting = new Set<number>()

export default class Party {
  static read<T> (roomId: number, key: string, fallback: T): T {
    const row = db.get<{ data: string }>('SELECT data FROM partyState WHERE roomId = ? AND key = ?', [roomId, key])
    return row ? JSON.parse(row.data) : fallback
  }

  static write (roomId: number, key: string, value: unknown) {
    db.run('INSERT INTO partyState (roomId, key, data) VALUES (?, ?, ?) ON CONFLICT(roomId, key) DO UPDATE SET data = excluded.data', [roomId, key, JSON.stringify(value)])
  }

  static enabled (roomId: number) {
    const prefs = Rooms.get(roomId, { status: STATUSES }).entities[roomId]?.prefs
    return Object.fromEntries(Object.keys(emptyParty.enabled).map(key => [key, !!prefs?.[key]?.isEnabled])) as Record<PartyGame, boolean>
  }

  static songs (): Song[] { return Object.values(Library.get().songs.entities) }

  static sungSongs (io, roomId: number): number[] {
    const sung = new Set(this.read<number[]>(roomId, 'sung', []))
    const queue = Queue.get(roomId)
    for (const id of Rooms.getPlayerHistory(io, roomId)) {
      const item = queue.entities[id]
      if (item?.type === 'song' || item?.type === 'battle') sung.add(item.songId)
      if (item?.type === 'battle') sung.add(item.opponentSongId)
    }
    return [...sung]
  }

  static card (roomId: number, userId: number): BingoCard {
    const existing = this.read<BingoCard | null>(roomId, `bingo:${userId}`, null)
    if (existing) return existing
    const songs = this.songs()
    const candidates: BingoSquare[] = []
    const add = (label: string, kind: BingoSquare['kind'], value: number, match?: string | number) => candidates.push({ label, kind, value, match, done: false })
    add('Hear the next song', 'song', 100)
    const tier = (frequency: number) => frequency >= 0.2 ? 100 : frequency >= 0.1 ? 200 : frequency >= 0.03 ? 300 : 400
    const tags = [...new Set(songs.flatMap(song => song.tags))]
    for (const tag of tags) {
      const frequency = songs.filter(song => song.tags.includes(tag)).length / songs.length
      add(`Hear ${tag}`, 'tag', tier(frequency), tag)
    }
    const artists = Library.get().artists.entities
    for (const id of [...new Set(songs.map(song => song.artistId))]) add(`Hear ${artists[id]?.name}`, 'artist', tier(songs.filter(song => song.artistId === id).length / songs.length), id)
    const enabled = this.enabled(roomId)
    const prefs = Rooms.get(roomId, { status: STATUSES }).entities[roomId]?.prefs
    if (enabled.spotTrivia) {
      add('Play trivia', 'triviaPlay', 100)
      add('Get a trivia answer right', 'triviaCorrect', 200)
      add('Win trivia', 'triviaWin', 400)
    }
    if (prefs?.battle?.isEnabled) {
      add('Start a battle', 'battleStart', 200)
      add('Win a battle', 'battleWin', 400)
    }
    if (enabled.roulette) add('Complete a roulette song', 'roulette', 200)
    if (enabled.nameThatKaraoke) {
      add('Play Name That Karaoke', 'namePlay', 100)
      add('Name a song correctly', 'nameCorrect', 300)
    }
    // Prefer broad conditions for easy cards. Exact titles supply the one rare square.
    const easy = shuffle(candidates.filter(c => c.value <= 200)).slice(0, 5)
    const rest = shuffle(candidates.filter(c => !easy.includes(c)))
    const squares = [...easy, ...rest].slice(0, 8)
    while (squares.length < 8) squares.push({ label: 'Hear the next song', kind: 'song', value: 100, done: false })
    const target = songs.length ? songs[randomInt(songs.length)] : null
    squares.push(target
      ? { label: `Hear ${artists[target.artistId]?.name} - ${target.title}`, kind: 'title', match: target.songId, value: 500, done: false }
      : { label: 'Hear the first library song', kind: 'song', value: 500, done: false })
    const card = { id: randomUUID(), squares: shuffle(squares), payout: 0, lines: [] }
    this.write(roomId, `bingo:${userId}`, card)
    return card
  }

  static event (roomId: number, kind: BingoSquare['kind'], userId?: number, song?: Song, also: BingoSquare['kind'][] = []) {
    if (!this.enabled(roomId).bingo) return
    const rows = db.all<{ key: string, data: string }>('SELECT key, data FROM partyState WHERE roomId = ? AND key LIKE \'bingo:%\'', [roomId])
    for (const row of rows) {
      const owner = Number(row.key.split(':')[1])
      const card: BingoCard = JSON.parse(row.data)
      if (card.payout) continue
      for (const square of card.squares) {
        const hit = song
          ? square.kind === 'song' || (square.kind === 'tag' && song.tags.includes(String(square.match))) || (square.kind === 'artist' && square.match === song.artistId) || (square.kind === 'title' && square.match === song.songId)
          : owner === userId && square.kind === kind
        const personalHit = owner === userId && also.includes(square.kind)
        if (hit || personalHit) square.done = true
      }
      Object.assign(card, bingoWin(card.squares))
      if (card.payout) Points.add(roomId, owner, card.payout, 'party')
      this.write(roomId, row.key, card)
    }
  }

  static state (roomId: number, userId: number, isAdmin = false): PartyState {
    const enabled = this.enabled(roomId)
    const active = rounds.get(roomId)
    const round = active ? { ...active.round, sentAt: Date.now() } : null
    if (round && !isAdmin) {
      delete round.mediaId
      delete round.mediaType
    }
    return {
      enabled,
      bingo: enabled.bingo ? this.card(roomId, userId) : null,
      roulette: this.read<RouletteDraw[]>(roomId, `roulette:${userId}`, []),
      round, answeredIdx: active?.answers[userId] ?? null,
    }
  }

  static push (io, roomId: number) {
    for (const sock of io.of('/').sockets.values()) {
      if (sock.user?.roomId === roomId) io.to(sock.id).emit('action', { type: PARTY_PUSH, payload: this.state(roomId, sock.user.userId, sock.user.isAdmin) })
    }
  }

  static roulette (roomId: number, userId: number, queueId: number, operation: string, filters: string[] = []) {
    if (!this.enabled(roomId).roulette) throw new Error('Roulette is disabled')
    const item = Queue.get(roomId).entities[queueId]
    if (!item || item.type !== 'song' || item.userId !== userId) throw new Error('Choose one of your singing turns')
    if (this.read<number[]>(roomId, 'completed', []).includes(queueId)) throw new Error('This turn has already ended')
    const draws = this.read<RouletteDraw[]>(roomId, `roulette:${userId}`, [])
    let draw = draws.find(d => d.queueId === queueId)
    if (operation === 'decline') {
      if (draw) {
        draw.declined = true
        draw.bonus = 0
        draw.songId = draw.originalSongId ?? item.songId
        db.run('UPDATE queue SET songId = ? WHERE queueId = ? AND roomId = ?', [draw.songId, queueId, roomId])
        this.write(roomId, `roulette:${userId}`, draws)
      }
      return
    }
    if (draw?.declined) throw new Error('Roulette was declined for this turn')
    if (operation === 'draw' && draw) throw new Error('Use reroll to draw again')
    if (operation === 'reroll' && !draw) throw new Error('Draw a song first')
    const selected = draw?.filters ?? filters
    if (!Array.isArray(selected) || selected.some(v => typeof v !== 'string') || new Set(selected).size !== selected.length || selected.length > 4) throw new Error('Choose up to four different metadata filters')
    const pool = matchingSongs(this.songs(), selected).filter(song => !draw?.poolSongIds || draw.poolSongIds.includes(song.songId))
    if (pool.length < 10) throw new Error('Broaden your filters to match at least 10 songs')
    const rerolls = draw ? draw.rerolls + 1 : 0
    const bonus = rouletteBonus(selected.length, rerolls)
    if (bonus < 0) throw new Error('No bonus remains for another reroll')
    const choices = pool.filter(song => song.songId !== draw?.songId)
    const song = choices[randomInt(choices.length)]
    if (!draw) {
      draw = { queueId, originalSongId: item.songId, poolSongIds: pool.map(song => song.songId), songId: song.songId, filters: selected, rerolls, bonus }
      draws.push(draw)
    } else Object.assign(draw, { songId: song.songId, rerolls, bonus })
    db.run('UPDATE queue SET songId = ?, keyChange = 0 WHERE queueId = ? AND roomId = ?', [song.songId, queueId, roomId])
    this.write(roomId, `roulette:${userId}`, draws)
  }

  static completed (io, roomId: number, queueId: number, skipped: boolean) {
    const completed = this.read<number[]>(roomId, 'completed', [])
    if (completed.includes(queueId)) return
    const item = Queue.get(roomId).entities[queueId]
    if (!item || item.type !== 'song') return
    this.write(roomId, 'completed', [...completed, queueId])
    const sung = this.sungSongs(io, roomId)
    this.write(roomId, 'sung', [...new Set([...sung, item.songId])])
    if (!skipped) {
      const song = this.songs().find(s => s.songId === item.songId)
      const draw = this.read<RouletteDraw[]>(roomId, `roulette:${item.userId}`, []).find(d => d.queueId === queueId && !d.declined && d.songId === item.songId)
      if (draw) {
        Points.add(roomId, item.userId, draw.bonus, 'party')
      }
      if (song) this.event(roomId, 'song', item.userId, song, draw ? ['roulette'] : [])
    }
    this.push(io, roomId)
    io.to(Rooms.prefix(roomId)).emit('action', { type: QUEUE_PUSH, payload: Queue.get(roomId) })
  }

  static async start (io, roomId: number, queueId: number) {
    if (rounds.get(roomId)?.round.queueId === queueId || starting.has(roomId)) return true
    if (rounds.has(roomId) && !rounds.get(roomId)?.round.closed) return false
    const item = Queue.get(roomId).entities[queueId]
    if (!item || item.isPlayed || (item.type !== 'spot' && item.type !== 'name')) return false
    const enabled = this.enabled(roomId)
    if (!(item.type === 'spot' ? enabled.spotTrivia : enabled.nameThatKaraoke)) return false
    const participants = Rooms.getSingers(io, roomId).map(s => s.userId)
    if (item.type === 'name' && participants.length < 3) return false
    starting.add(roomId)
    try {
      let correctIdx = 0
      let songId = 0
      const round: PartyRound = { id: randomUUID(), queueId, kind: item.type, question: 'What song is playing?', options: [], participants, answered: [], winners: [], closed: false }
      if (item.type === 'name') {
        const sung = this.sungSongs(io, roomId)
        const pool = this.songs().filter(s => !sung.includes(s.songId))
        if (!pool.length) return false
        const song = pool[randomInt(pool.length)]
        songId = song.songId
        const artists = Library.get().artists.entities
        const label = (s: Song) => `${artists[s.artistId]?.name} - ${s.title}`
        round.options = shuffle([label(song), ...shuffle([...new Set(this.songs().map(label))].filter(l => l !== label(song))).slice(0, 3)])
        correctIdx = round.options.indexOf(label(song))
        const media = db.get<{ mediaId: number, relPath: string }>('SELECT mediaId, relPath FROM media WHERE songId = ? ORDER BY isPreferred DESC, mediaId LIMIT 1', [song.songId])
        if (!media) return false
        round.mediaId = media.mediaId
        round.mediaType = Queue.getType(media.relPath) as 'mp4' | 'cdg'
      } else {
        const questions = await fetchQuestions(1, 'easy')
        if (!questions.length || !this.enabled(roomId).spotTrivia || !Queue.get(roomId).entities[queueId]) return false
        const question = questions[0]
        round.question = question.question
        round.options = shuffle([question.correctAnswer, ...question.incorrectAnswers])
        correctIdx = round.options.indexOf(question.correctAnswer)
        round.endsAt = Date.now() + 20000
      }
      db.run('UPDATE queue SET datePlayed = ? WHERE queueId = ?', [Date.now(), queueId])
      const active: Active = { round, correctIdx, songId, answers: {} }
      rounds.set(roomId, active)
      this.write(roomId, 'lastInterlude', item.type)
      if (round.endsAt) active.timer = setTimeout(() => this.finish(io, roomId), 20000)
      this.push(io, roomId)
      return true
    } finally { starting.delete(roomId) }
  }

  static answer (io, roomId: number, userId: number, id: string, index: number) {
    const active = rounds.get(roomId)
    if (!active || active.round.id !== id || active.round.closed) throw new Error('This round has ended')
    const round = active.round
    if (!round.participants.includes(userId)) throw new Error('Join the next round')
    if (userId in active.answers) throw new Error('Your answer is locked')
    if (!Number.isInteger(index) || index < 0 || index >= round.options.length) throw new Error('Invalid answer')
    active.answers[userId] = index
    round.answered.push(userId)
    if (index === active.correctIdx) {
      const points = round.kind === 'name' ? [500, 250, 100][round.winners.length] : 100
      const name = db.get<{ name: string }>('SELECT name FROM users WHERE userId = ?', [userId])?.name ?? 'Player'
      round.winners.push({ userId, name, points })
      Points.add(roomId, userId, points, 'party')
    }
    this.event(roomId, round.kind === 'name' ? 'namePlay' : 'triviaPlay', userId, undefined, index === active.correctIdx ? [round.kind === 'name' ? 'nameCorrect' : 'triviaCorrect'] : [])
    const notAnsweredUsersCount = round.participants.filter(id => !(id in active.answers)).length
    if ((round.kind === 'name' && round.winners.length === 3) || notAnsweredUsersCount === 0) this.finish(io, roomId)
    else this.push(io, roomId)
  }

  static finish (io, roomId: number) {
    const active = rounds.get(roomId)
    if (!active || active.round.closed) return
    clearTimeout(active.timer)
    active.round.closed = true
    active.round.correctIdx = active.correctIdx
    this.syncQueueAndPush(io, roomId)
    if (active.round.kind === 'spot') for (const winner of active.round.winners) this.event(roomId, 'triviaWin', winner.userId)
    this.push(io, roomId)
    Points.push(io, roomId)
  }

  static battleSong (io, roomId: number, songId: number) {
    const sung = this.read<number[]>(roomId, 'sung', [])
    this.write(roomId, 'sung', [...new Set([...sung, songId])])
    const song = this.songs().find(s => s.songId === songId)
    if (song) this.event(roomId, 'song', undefined, song)
    if (this.enabled(roomId).bingo) {
      this.push(io, roomId)
      Points.push(io, roomId)
    }
  }

  /** Keep one room turn waiting, using the former trivia insertion schedule. */
  static syncQueue (io, roomId: number): boolean {
    const before = Queue.get(roomId).result.join(',')
    // Retire full rounds already queued by an older server.
    Queue.removePendingTrivia(roomId)
    Queue.removeSpentTrivia(roomId)
    const enabled = this.enabled(roomId)
    const sung = this.sungSongs(io, roomId)
    const nameAvailable = enabled.nameThatKaraoke && Rooms.countSingers(io, roomId) >= 3
      && this.songs().some(song => !sung.includes(song.songId))
    const pending = db.all<{ queueId: number, type: string }>('SELECT queueId, type FROM queue WHERE roomId = ? AND type IN (\'spot\', \'name\') AND datePlayed IS NULL', [roomId])
    for (const row of pending) {
      if (row.type === 'spot' ? !enabled.spotTrivia : !nameAvailable) Queue.remove(row.queueId)
    }
    const active = rounds.get(roomId)
    const hasPending = db.get('SELECT queueId FROM queue WHERE roomId = ? AND type IN (\'spot\', \'name\') AND datePlayed IS NULL', [roomId])
    if (!hasPending && !starting.has(roomId) && (!active || active.round.closed) && Rooms.isPlayerPlaying(io, roomId)) {
      const history = new Set([...Rooms.getPlayerHistory(io, roomId), ...this.read<number[]>(roomId, 'completed', [])])
      const queue = Queue.get(roomId)
      const stillToSing = queue.result.some(id => !history.has(id) && (queue.entities[id].type === 'song' || queue.entities[id].type === 'battle'))
      const kind = chooseInterlude(enabled.spotTrivia, nameAvailable, this.read<Interlude | null>(roomId, 'lastInterlude', null))
      if (stillToSing && kind) Queue.addParty(roomId, kind)
    }
    return before !== Queue.get(roomId).result.join(',')
  }

  static syncQueueAndPush (io, roomId: number) {
    if (this.syncQueue(io, roomId)) io.to(Rooms.prefix(roomId)).emit('action', { type: QUEUE_PUSH, payload: Queue.get(roomId) })
  }

  static sync (io, roomId: number) {
    this.syncQueue(io, roomId)
    this.push(io, roomId)
    io.to(Rooms.prefix(roomId)).emit('action', { type: QUEUE_PUSH, payload: Queue.get(roomId) })
  }

  static reset (roomId: number) {
    clearTimeout(rounds.get(roomId)?.timer)
    rounds.delete(roomId)
    db.run('DELETE FROM partyState WHERE roomId = ?', [roomId])
  }

  static dismiss (roomId: number, userId: number, id: string) {
    const card = this.read<BingoCard | null>(roomId, `bingo:${userId}`, null)
    if (!card || card.id !== id || !card.payout) throw new Error('No bingo win to dismiss')
    db.run('DELETE FROM partyState WHERE roomId = ? AND key = ?', [roomId, `bingo:${userId}`])
    this.card(roomId, userId)
  }
}
