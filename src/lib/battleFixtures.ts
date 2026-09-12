import { BATTLE_VERSUS_MS } from 'shared/types'
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
  // each fighter sings what the other picked, which is the whole point
  challengerSong: { songId: 10, artist: 'Heart', title: 'Barracuda' },
  opponentSong: { songId: 11, artist: 'Toto', title: 'Africa' },
  judging: 'crowd',
  // 0 until the judging beat has finished
  challengerScore: 0,
  opponentScore: 0,
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
  isAccepted: false,
  ...over,
})

export const battleSinger = (over: Partial<BattleSinger> = {}): BattleSinger => ({
  userId: 2,
  name: 'Barf',
  dateUpdated: 1700000001,
  ...over,
})
