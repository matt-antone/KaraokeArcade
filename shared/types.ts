export interface Artist {
  artistId: number
  name: string
  songIds: number[]
}

export interface Song {
  artistId: number
  duration: number
  songId: number
  title: string
  tags: string[]
  numMedia: number
}

/** Semitones a singer may shift a song either way. Six is a tritone: past it
 *  the shift is better spelled as the other direction, and every extra
 *  semitone costs phase-vocoder quality. */
export const KEY_CHANGE_MAX = 6

/** Clamp to a whole semitone inside the supported range. Both the socket
 *  handler and the stepper route through this so a hand-crafted payload
 *  cannot store a key the player would refuse to shift to. */
export const clampKeyChange = (n: number): number => (
  Number.isFinite(n) ? Math.max(-KEY_CHANGE_MAX, Math.min(KEY_CHANGE_MAX, Math.trunc(n))) : 0
)

/** What a queue row is. A trivia round takes a turn in the rotation just as a
 *  singer does, but has neither a singer nor anything to play — so the row
 *  carries its kind, and the fields a round has no use for come back as 0.
 *
 *  0 rather than null on the wire: every consumer that already filters by
 *  userId or looks a song up by songId keeps working untouched, because no
 *  user or song has id 0. The database stores real NULLs. */
export type QueueItemType = 'song' | 'trivia' | 'battle'

/** Rounds are told apart by this and nothing else — never by a missing song or
 *  an absent singer, which are consequences rather than the fact itself. */
export const isTriviaItem = (item?: { type?: QueueItemType }): boolean => item?.type === 'trivia'

/** Same rule for a battle: one turn, two singers, two songs. A battle row is
 *  deliberately readable as an ordinary one — userId sings songId — so code
 *  that has not been taught about battles shows the challenger and their song
 *  rather than crashing on a missing field. Only the places that must know the
 *  difference ask. */
export const isBattleItem = (item?: { type?: QueueItemType }): boolean => item?.type === 'battle'

/** The rotation's reserved singers.
 *
 * A trivia round and a singer battle each take a turn in the round-robin as
 * themselves rather than as a person, so each needs an id of its own to be
 * dealt under. A round already had one by accident — it is inserted with no
 * user at all and arrives as 0 — and that was fine while it was the only
 * thing in the queue that was not somebody's song.
 *
 * A battle cannot borrow the same trick. Its row *does* carry a real userId,
 * the challenger's, because the fight needs to know who is in it; deal on that
 * and the battle spends the challenger's turn while the opponent sings for
 * free, still recorded as never having sung, and the rotation hands them their
 * own song immediately after. So the battle is dealt under a reserved id of
 * its own instead, and comes round once per lap the way a round does — the
 * challenger's userId stays on the row for everything that actually needs it.
 *
 * Negative because every real userId is a positive autoincrement and 0 is
 * already spoken for, so these can never collide with a person.
 */
const TRIVIA_ROTATION_ID = 0
const BATTLE_ROTATION_ID = -1

/** Which singer a queue row takes its turn as. A person for an ordinary song,
 *  and one of the reserved ids above for the two kinds of row that are the
 *  room's turn rather than anyone's. */
export const rotationIdOf = (item: { type?: QueueItemType, userId: number }): number => {
  if (isTriviaItem(item)) return TRIVIA_ROTATION_ID
  if (isBattleItem(item)) return BATTLE_ROTATION_ID

  return item.userId
}

export interface QueueItem {
  queueId: number
  type: QueueItemType
  /** 0 on a trivia round. */
  songId: number
  /** 0 on a trivia round. */
  userId: number
  /** Trivia rows only: the round has already been asked, in this session or a
   *  previous one. Play history lives in the running player and does not
   *  survive a reload, so without this a restarted player keeps landing on
   *  rounds the room has already had — and skips a turn on each. */
  isPlayed?: boolean
  prevQueueId: number
  /** Semitones to shift playback; 0 is the recording's own key. */
  keyChange: number
  mediaId: number
  rgTrackGain: number
  rgTrackPeak: number
  userDateUpdated: number
  userDisplayName: string
  mediaType: 'cdg' | 'mp4'
  isOptimistic?: false
  isVideoKeyingEnabled: boolean
  /** Battle rows only, and 0 on every other row for the same reason songId and
   *  userId are — no user and no song has id 0, so a consumer that filters on
   *  these without knowing about battles filters them all out rather than
   *  reading undefined. */
  opponentUserId: number
  opponentSongId: number
  opponentDisplayName: string
  opponentDateUpdated: number
  /** The opponent's half of the turn, resolved from its own media row. Null on
   *  a row with no second song. */
  opponentMediaId: number
  opponentMediaType: 'cdg' | 'mp4' | null
  opponentKeyChange: number
  opponentRgTrackGain: number
  opponentRgTrackPeak: number
  opponentIsVideoKeyingEnabled: boolean
}

export interface OptimisticQueueItem {
  isOptimistic: true
  type?: QueueItemType
  prevQueueId: number
  queueId: number
  songId: number
}

export interface SongHistoryItem {
  songId: number
  artist: string
  title: string
  dateSung: number
}

export interface IRoomPrefs {
  qr: {
    isEnabled: boolean
    opacity: number
    password: string
    size: number
  }
  trivia?: {
    isEnabled?: boolean
    /** How long an answer stays open, in seconds. */
    countdownSeconds?: number
  }
  battle?: {
    isEnabled?: boolean
    /** How a fight is decided. Absent on every room made before there was a
     *  choice, which reads as the default — see BATTLE_JUDGING_DEFAULT. */
    judging?: BattleJudgingPref
    /** Which fighter groups (folders under assets/battle/fighters) the
     *  chooser shows, by folder name. Read through isBattleGroupOn: `default`
     *  is on unless set false, every other group off unless set true. */
    groups?: Record<string, boolean>
  }
  user?: {
    isNewAllowed?: boolean
    isGuestAllowed?: boolean
  }
  roles?: Record<number, {
    allowNew: boolean
  }>
}

/** A room's transport, and the only gate on getting into it.
 *  - `play`     the room runs: singers join, queue up, and the player plays
 *  - `paused`   an intermission. Nobody new joins and nothing new is queued,
 *               and the player is stopped, but the queue and the scoreboard
 *               are exactly where the room left them
 *  - `stopped`  the night is over. Same gate as paused, and the queue and the
 *               scores are cleared when it is pressed
 *
 *  paused and stopped keep out the same people; the difference is entirely in
 *  what pressing stop threw away. */
export type RoomStatus = 'play' | 'paused' | 'stopped'

export const ROOM_STATUSES: RoomStatus[] = ['play', 'paused', 'stopped']

export interface Room {
  roomId: number
  name: string
  status: RoomStatus
  dateCreated: number
  hasPassword: boolean
  numUsers: number
  prefs?: IRoomPrefs
}

export interface Role {
  roleId: number
  name: string
}

export interface Path {
  pathId: number
  path: string
  priority: number
  /** Number of distinct songs with media under this path. */
  numSongs: number
  prefs: {
    isVideoKeyingEnabled: boolean
    isWatchingEnabled: boolean
  }
}

export interface User {
  userId: number
  username: string
  name: string
  isAdmin: boolean // todo: client and server ctx only
  isGuest: boolean // todo: client and server ctx only
  dateCreated: number
  dateUpdated: number
}

export interface UserWithRole extends User {
  role?: string
}

export interface PlaybackOptions {
  cdgAlpha?: number
  cdgSize?: number
  mp4Alpha?: number
  visualizer?: {
    sensitivity?: number
    isEnabled?: boolean
    nextPreset?: boolean
    prevPreset?: boolean
    randomPreset?: boolean
  }
}

export type MediaType = 'cdg' | 'mp4' | ''

export interface Prefs {
  isFirstRun?: boolean
  isScanning: boolean
  isReplayGainEnabled: boolean
  paths: {
    result: number[]
    entities: Record<number, Path>
  }
  roles: {
    result: number[]
    entities: Record<number, Role>
  }
  [key: string]: unknown
}

/** Answers per round. OpenTDB's type=multiple returns exactly one correct and
 *  three incorrect, which is where the four answer keys come from — this is a
 *  property of the source, not a layout choice, so it is not configurable. */
export const TRIVIA_ANSWER_COUNT = 4

/** Questions in one round. A round is a turn in the rotation, and one question
 *  is a thin turn — five is enough for the room to get into it and still hand
 *  the microphone back. Also the amount OpenTDB's own example fetches. */
export const TRIVIA_QUESTIONS_PER_ROUND = 5

/** Bounds on how long an answer stays open. Below the floor a guest cannot
 *  read four answers and reach for a key; above the ceiling the room is
 *  waiting on trivia rather than playing it. */
export const TRIVIA_COUNTDOWN_MIN = 5
export const TRIVIA_COUNTDOWN_MAX = 60
export const TRIVIA_COUNTDOWN_DEFAULT = 20

export const clampTriviaCountdown = (n: number): number => (
  Number.isFinite(n)
    ? Math.max(TRIVIA_COUNTDOWN_MIN, Math.min(TRIVIA_COUNTDOWN_MAX, Math.trunc(n)))
    : TRIVIA_COUNTDOWN_DEFAULT
)

/** A round in progress, as the room sees it. Deliberately carries no hint of
 *  which answer is right: the player screen and every phone get this same
 *  payload, and a client that knows the answer early is a client that can be
 *  made to show it. The correct index arrives in TriviaResult once answering
 *  has closed. */
export interface TriviaRound {
  /** Identifies one *question*. A round asks several, each with its own id,
   *  so an answer can never be applied to the wrong one. */
  roundId: number
  /** The queue row being asked. The player uses it to tell "my row's round"
   *  from one it has already seen through. */
  queueId: number
  /** 1-based, and how many the round holds — the room needs to know how far
   *  through it is. */
  questionNumber: number
  questionCount: number
  question: string
  /** Exactly TRIVIA_ANSWER_COUNT, already shuffled by the server. */
  answers: string[]
  difficulty: string
  /** Epoch ms the countdown expires. */
  endsAt: number
  /** Epoch ms this payload was sent, by the server's clock. Every other time
   *  here is the server's too, and the machines reading them — a TV box, a
   *  phone — have their own. Pairing the deadlines with the moment they were
   *  stamped lets a client subtract the difference out; without it a player
   *  whose clock is a few seconds off silently skips whole beats. */
  sentAt: number
}

/** The server's answer to "put this row's round on".
 *  - `started`      it just began; wait for it
 *  - `inProgress`   already under way on this row; wait for it
 *  - `unavailable`  no questions cached, or this row was already asked; move on
 *
 *  The first two are the same instruction and the third is its opposite, which
 *  is exactly why this is three named values rather than a boolean. */
export type TriviaRoundRequestStatus = 'started' | 'inProgress' | 'unavailable'

export interface TriviaScore {
  userId: number
  name: string
  score: number
  numAnswered: number
}

export interface TriviaResult {
  roundId: number
  queueId: number
  questionNumber: number
  questionCount: number
  /** The last question of the round: the scoreboard goes up, and the player
   *  moves on to the next singer once the reveal is over. */
  isFinal: boolean
  correctIdx: number
  /** Everyone who has answered at least once this room, best first. */
  scores: TriviaScore[]
  /** How many of the room got *this* question. The scoreboard says where the
   *  night stands; this is what the room reacts to out loud. */
  numCorrect: number
  /** Epoch ms the count takes over from the answer. Separate beats — you read
   *  what it was, then you see how the room did — because showing them at once
   *  means neither lands. Every question gets both. */
  scoresFrom: number
  /** Epoch ms the standings take over from the count, or null when there are
   *  no standings this question. Only the last one has them: it is the round's
   *  result rather than a checkpoint, so it earns a third beat and holds it
   *  twice as long. */
  boardFrom: number | null
  /** Epoch ms the reveal stops being shown — and, when isFinal, the earliest
   *  the next song may load. */
  endsAt: number
  /** Epoch ms this payload was sent. See TriviaRound.sentAt. */
  sentAt: number
}

/** How long each beat of a battle holds the stage, in ms. The whole sequence
 *  is ten beats and runs a shade over five minutes, so these are the numbers
 *  that decide how much of the night one battle costs.
 *
 *  The two opening splashes are deliberately unequal: the title card is the
 *  shortest beat in the sequence because it says one word, and the versus card
 *  is the longest of the three because it is a scene rather than a still — the
 *  fighters and the field slide on, hold, and slide back off, and the hold is
 *  the only part of it the room is meant to read. The judging beats are longer
 *  because a crowd needs a moment to work out it is being asked for something. */
/** The title card: the Singer Battle lockup, and nothing else on the screen.
 *
 *  Its own beat rather than the gap before one. The lockup used to be drawn
 *  only by the player's holding card — the thing on screen while the server's
 *  first payload is in flight — which made the opening scene of a battle a
 *  race against the network: on a quick room nobody saw it, and the one place
 *  it reliably stayed up was the end of the queue, where it was stuck. A scene
 *  the room is meant to see is a beat like any other, sent by the server and
 *  the same length on every screen watching. */
export const BATTLE_LOGO_MS = 3000

/** The versus card, which is three movements rather than one still: 2s for the
 *  fighters to walk on (the field beats them there in 1.75s), a 5s hold that is
 *  the card itself, and 1.5s to clear the stage for the first intro. The three
 *  add up to this number, and PlayerBattle.css animates against it — change one
 *  and the other has to move with it. */
export const BATTLE_VERSUS_MS = 8500
export const BATTLE_INTRO_MS = 12000
export const BATTLE_JUDGE_MS = 5000
export const BATTLE_METER_MS = 15000
export const BATTLE_WINNER_MS = 15000

/** How long the ask holds the stage when the room is voting on its phones.
 *
 *  On the ballot path the ask and the voting are the same beat, because a vote
 *  has nothing to look at while it happens — the question, the two names and
 *  the filling ballot row are one screen. That makes this beat the whole
 *  judging section, and it is the two metering beats added together (15 + 15)
 *  so the two paths cost a night about the same.
 *
 *  About, not exactly: the crowd path pays a 5s `judge` ask on top of its two
 *  meters, because there the question and the measuring are separate beats and
 *  a room needs a moment to work out it is being asked for something. A ballot
 *  has that moment built in — the question is on screen for the whole thirty
 *  seconds you are voting. */
export const BATTLE_JUDGE_BALLOT_MS = BATTLE_METER_MS * 2

/** How long a challenge stands before it lapses. Invites do not sit open all
 *  night: the room moves on, and a challenge nobody answered should stop being
 *  a thing the challenger is waiting on. Counted by the server — a phone that
 *  slept through it comes back to a lapsed invite, not a live one. */
export const BATTLE_INVITE_MS = 45000

/** How much of each song gets sung. Two minutes is about a verse, a chorus and
 *  out — long enough to be a performance, short enough that the other fighter
 *  is still in the room for it. A song shorter than this simply ends and the
 *  battle moves on early. */
export const BATTLE_SING_MS = 120000

/** The beats, in order. The player draws one thing per beat and nothing else,
 *  and the server hands out exactly one of these at a time.
 *
 *  - `logo`     the title card: Singer Battle, and nothing else
 *  - `versus`   both fighters, both songs, before a note is played
 *  - `intro1`   the challenger alone
 *  - `sing1`    the challenger sings the song their opponent chose
 *  - `intro2`   the opponent alone
 *  - `sing2`    the opponent sings the song the challenger chose
 *  - `judge`    the ask: who wins. On the ballot path this beat *is* the vote
 *  - `meter1`   the room is heard for the challenger
 *  - `meter2`   the room is heard for the opponent
 *  - `winner`   the verdict, with both grades
 *
 *  The judging section is `judge` alone under `ballot` and `judge meter1
 *  meter2` under `crowd`; a room whose player cannot hear it gets the short
 *  `judge` and no metering at all. There is no separate `ballot` phase: asking
 *  the room and counting the room are one screen, so they are one beat. */
export type BattlePhase
  = | 'logo'
    | 'versus'
    | 'intro1'
    | 'sing1'
    | 'intro2'
    | 'sing2'
    | 'judge'
    | 'meter1'
    | 'meter2'
    | 'winner'

/** How a room settles a fight.
 *
 *  - `ballot`  every phone in the room votes, and nobody sees the count until
 *              the verdict. The default, because it is the only one that works
 *              on a player opened anywhere but the server's own machine
 *  - `crowd`   the player's microphone grades how loud the room was for each
 *              fighter in turn
 *  - `none`    the room asked for `crowd` and this player cannot hear it. Both
 *              metering beats are skipped and the verdict is a draw
 *
 *  `none` is a fact about one fight rather than a setting, which is why the
 *  room's pref is the narrower BattleJudgingPref. */
export type BattleJudging = 'ballot' | 'crowd' | 'none'

export type BattleJudgingPref = Exclude<BattleJudging, 'none'>

export const BATTLE_JUDGING_DEFAULT: BattleJudgingPref = 'ballot'

/** Which fighter a beat or a score belongs to. 1 is always the challenger. */
export type BattleSide = 1 | 2

/** A battle in progress, as the whole room sees it. One of these is emitted
 *  per beat rather than one for the sequence, because the two singing beats
 *  end on whichever comes first — the two-minute cut or the song running out —
 *  and a pre-stamped sequence would be wrong from beat three onwards. */
export interface BattleTurn {
  /** The queue row being fought over. The player uses it to tell its own row's
   *  battle from one it has already seen through. */
  queueId: number
  phase: BattlePhase
  /** Epoch ms this beat gives way to the next. Every beat has one, including
   *  the singing beats, where it is the two-minute cut. */
  endsAt: number
  /** Epoch ms this payload was sent, by the server's clock. See
   *  TriviaRound.sentAt — same reason, same correction. */
  sentAt: number
  challengerUserId: number
  challengerName: string
  challengerDateUpdated: number
  opponentUserId: number
  opponentName: string
  opponentDateUpdated: number
  /** Who each of them is singing *as* — a roster id from BATTLE_SINGERS, which
   *  is client-side art rather than anything the server holds a copy of. The
   *  server carries the string and nothing else; the stage looks up the
   *  drawing. Empty on a battle started before the roster shipped, which
   *  battleSingerOrDefault covers. */
  challengerSingerId: string
  opponentSingerId: string
  /** What each fighter sings, already resolved to artist and title so the
   *  splash does not have to reach into the library. */
  challengerSong: BattleSong
  opponentSong: BattleSong
  /** How this fight is being decided, settled before the first beat. */
  judging: BattleJudging
  /** That fighter's grade: votes cast for them under `ballot`, how loud the
   *  room was for them under `crowd`. 0 until the judging beat has finished —
   *  a ballot in progress is silent, or it is not a ballot. */
  challengerScore: number
  opponentScore: number
  /** How many phones have voted, and how many could. Not the split, and never
   *  the split: one number for the whole room, which is exactly what both the
   *  TV's ballot row and the phone's draw — every filled cell identical, no
   *  matter which way it went.
   *
   *  The distinction is the whole design. A room that cannot see voting
   *  happening thinks the feature is broken and stops. A room that can see who
   *  is winning stops voting on who sang and starts voting with the crowd, and
   *  the late half of the room decides the fight. Showing the count and hiding
   *  the split is the only arrangement that avoids both.
   *
   *  `ballotsOf` is measured once, as the battle starts, and is the room minus
   *  the two fighters — they hold phones like everyone else but neither of
   *  them votes. Both are 0 on every path but `ballot`. */
  ballotsIn: number
  ballotsOf: number
}

export interface BattleSong {
  songId: number
  artist: string
  title: string
}

/** Somebody in the room who could be challenged. Deliberately not `User`: a
 *  phone has no business knowing who is an admin or what anyone's username is,
 *  and this list is assembled from live sockets rather than from the users
 *  table. */
export interface BattleSinger {
  userId: number
  name: string
  dateUpdated: number
}

/** A challenge that has been thrown and not yet answered. The challenger holds
 *  one of these to know it is waiting; the opponent holds one to know it is
 *  being asked. */
export interface BattleInvite {
  challengerUserId: number
  challengerName: string
  challengerDateUpdated: number
  opponentUserId: number
  opponentName: string
  opponentDateUpdated: number
  /** The song the challenger picked for the opponent to sing. Shown on the
   *  invite because "do you want to battle" and "singing this" are one
   *  decision, not two. */
  songId: number
  artist: string
  title: string
  /** Who the challenger is singing as, chosen before the invite went out. The
   *  opponent's invite draws this fighter full-bleed behind the ask, and their
   *  own select grid marks the tile TAKEN — two people cannot sing as the same
   *  fighter in one battle. */
  challengerSingerId: string
  /** Who the opponent picked. Empty until they accept, because picking is part
   *  of accepting. */
  opponentSingerId: string
  /** Epoch ms this challenge lapses. Server-authoritative: the phone counts
   *  down to it for the clock on screen, and the server is what actually ends
   *  it. See BATTLE_INVITE_MS. */
  expiresAt: number
  /** Set once the opponent accepts and is choosing the challenger's song. */
  isAccepted: boolean
}

/**
 * Why a challenge stopped existing.
 *
 * The server sends one of these every time an invite is cleared, because the
 * four ways a challenge can end are one message on the wire and four different
 * screens on a phone — and two of them, `declined` and `expired`, are the pair
 * a person actually asks about. "They said no" and "they never picked their
 * phone up" feel nothing alike to the challenger, and a screen that cannot
 * tell them apart says the unkind one to somebody who was in the toilet.
 *
 * `matched` is the happy ending — both songs are settled and the row exists —
 * and it comes through the same clear, which is why it needs a name too: a
 * missing one would read as a decline the instant a battle was successfully
 * arranged.
 *
 * One emitter has no reason to give: stopping a room clears every invite in it
 * from server/Rooms/transport.ts, and a room being shut is not an outcome of
 * the negotiation. That arrives without a reason and leaves the phone showing
 * nothing, which is correct — nobody decided anything.
 */
export type BattleInviteEnd = 'declined' | 'cancelled' | 'expired' | 'matched'

/** The server's answer to "run this row's battle".
 *  - `started`      it just began; wait for it
 *  - `inProgress`   already under way on this row; wait for it
 *  - `unavailable`  this row is not a battle, or is already spent; move on
 *
 *  Three named values rather than a boolean for the reason spelled out on
 *  TriviaRoundRequestStatus: two of these mean wait and the third means the
 *  opposite, and collapsing them ends the feature after its first beat under
 *  React's double-invoked effects. */
export type BattleTurnRequestStatus = 'started' | 'inProgress' | 'unavailable'

/** Bounds on a fighter's grade. Out of 100 because that is how a room reads a
 *  score without being told how to — and a ceiling a ballot never reaches
 *  either, there being no room with a hundred phones in it. */
export const BATTLE_SCORE_MAX = 100

export const clampBattleScore = (n: number): number => (
  Number.isFinite(n) ? Math.max(0, Math.min(BATTLE_SCORE_MAX, Math.round(n))) : 0
)
