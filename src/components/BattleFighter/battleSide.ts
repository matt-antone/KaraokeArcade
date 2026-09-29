import { battleSingerOrDefault } from 'lib/battleSingers'
import type { BattleSide, BattleTurn } from 'shared/types'

/** Everything one side of the fight has. */
export const sideOf = (turn: BattleTurn, at: BattleSide) => (at === 1
  ? {
      name: turn.challengerName,
      song: turn.challengerSong,
      score: turn.challengerScore,
      votes: turn.challengerVotes,
      singer: battleSingerOrDefault(turn.challengerSingerId),
    }
  : {
      name: turn.opponentName,
      song: turn.opponentSong,
      score: turn.opponentScore,
      votes: turn.opponentVotes,
      singer: battleSingerOrDefault(turn.opponentSingerId),
    })
