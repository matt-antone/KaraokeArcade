import type { LeaderboardEntry, TriviaPodium } from 'shared/types'

/** How tall each podium stands, first to fifth (12b, 12c). The design stands
 *  five and no more: its stage is five columns wide. */
export const PODIUM_HEIGHTS = [112, 96, 82, 70, 60]

/**
 * Who stands on the podiums: the round so far, best first, as the server
 * sends it — then, while there is room, whoever else is in tonight at 0.
 *
 * The fill is for the first question. Before anyone has answered the round
 * has nobody in it, and five empty podiums say "nobody is playing" to a room
 * that is about to. Everyone on the night's board can answer, so they stand
 * up in the board's order, below anyone who has actually played.
 */
export function podiumsOf (podiums: TriviaPodium[] = [], leaderboard: LeaderboardEntry[] = []): TriviaPodium[] {
  const standing = new Set(podiums.map(p => p.userId))
  const waiting = leaderboard
    .filter(e => !standing.has(e.userId))
    .map(({ userId, name, avatarId }): TriviaPodium => ({ userId, name, avatarId, points: 0, numCorrect: 0 }))

  return [...podiums, ...waiting].slice(0, PODIUM_HEIGHTS.length)
}
