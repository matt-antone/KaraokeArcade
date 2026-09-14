import { BATTLE_INVITE_MS, BATTLE_VERSUS_MS } from 'shared/types'
import type { BattleInvite, BattleSinger, BattleTurn } from 'shared/types'

/**
 * The three payloads a battle is made of, for the screens that draw them.
 *
 * Test-only, and shared for the same reason triviaFixtures is: the player, the
 * phone's invite modal and the library's picking banner all render pieces of
 * the same negotiation, and three hand-rolled copies of a BattleTurn drift
 * apart on which fields they bother to set within a week.
 *
 * The default is the opening beat of a crowd-judged battle between two people
 * with real names — the case every screen has to get right — so a bare call is
 * a realistic payload rather than a skeleton.
 */
export const battleTurn = (over: Partial<BattleTurn> = {}): BattleTurn => ({
  queueId: 7,
  phase: 'versus',
  endsAt: Date.now() + BATTLE_VERSUS_MS,
  sentAt: Date.now(),
  challengerUserId: 1,
  challengerName: 'Dot Matrix',
  challengerDateUpdated: 1700000000,
  opponentUserId: 2,
  opponentName: 'Barf',
  opponentDateUpdated: 1700000001,
  // the two fighters with finished art, so a test that renders a stage renders
  // the case the room will actually see rather than two locked question marks
  challengerSingerId: 'p1',
  opponentSingerId: 'p2',
  // each fighter sings what the other picked, which is the whole point
  challengerSong: { songId: 10, artist: 'Heart', title: 'Barracuda' },
  opponentSong: { songId: 11, artist: 'Toto', title: 'Africa' },
  judging: 'crowd',
  // 0 until the judging beat has finished
  challengerScore: 0,
  opponentScore: 0,
  // Both 0 on every path but `ballot`, and the default here is a crowd-judged
  // fight — a ballot test sets its own room size along with `judging`.
  ballotsIn: 0,
  ballotsOf: 0,
  ...over,
})

/** Unaccepted by default: the modal on the opponent's phone is the state most
 *  tests are about, and accepting is one `{ isAccepted: true }` away. */
export const battleInvite = (over: Partial<BattleInvite> = {}): BattleInvite => ({
  challengerUserId: 1,
  challengerName: 'Dot Matrix',
  challengerDateUpdated: 1700000000,
  opponentUserId: 2,
  opponentName: 'Barf',
  opponentDateUpdated: 1700000001,
  // the song the challenger picked for the opponent to sing
  songId: 11,
  artist: 'Toto',
  title: 'Africa',
  challengerSingerId: 'p1',
  // empty, matching the unaccepted default: the opponent picks their fighter
  // on the way to saying yes, so an invite still being asked has no answer yet
  opponentSingerId: '',
  expiresAt: Date.now() + BATTLE_INVITE_MS,
  isAccepted: false,
  ...over,
})

export const battleSinger = (over: Partial<BattleSinger> = {}): BattleSinger => ({
  userId: 2,
  name: 'Barf',
  dateUpdated: 1700000001,
  ...over,
})
