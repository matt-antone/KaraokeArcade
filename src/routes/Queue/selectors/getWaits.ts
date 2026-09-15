import type { RootState } from 'store/store'
import { createSelector } from '@reduxjs/toolkit'
import {
  BATTLE_INTRO_MS,
  BATTLE_JUDGE_MS,
  BATTLE_LOGO_MS,
  BATTLE_METER_MS,
  BATTLE_SING_MS,
  BATTLE_VERSUS_MS,
  BATTLE_WINNER_MS,
  isBattleItem,
} from 'shared/types'
import type { QueueItem } from 'shared/types'
import getPlayerHistory from './getPlayerHistory'
import getRoundRobinQueue from './getRoundRobinQueue'

const getPosition = (state: RootState) => state.status.position
const getQueue = (state: RootState) => getRoundRobinQueue(state)
const getQueueId = (state: RootState) => state.status.queueId
const getSongs = (state: RootState) => state.songs

/** Everything in a battle that is not singing: the title card, the versus
 *  splash, both fighter intros, the judging section and the verdict. Seconds, because every
 *  duration in this file is.
 *
 *  The judging section is the crowd path's — a short ask plus two metering
 *  beats — and it is counted whichever way the room actually decides its
 *  fights, for two reasons that point the same way.
 *
 *  This selector cannot know which path will run. Judging is settled per
 *  battle by whether the player that reaches the row can hear the room, which
 *  has not happened yet and may not be the player that is plugged in now.
 *
 *  And where the two differ, the crowd path is the longer: five seconds of
 *  asking plus thirty of metering, against the ballot's single thirty-second
 *  beat that is the ask and the vote at once. Taking the longer over-states a
 *  ballot-judged battle by those five seconds and is never short. Every wait
 *  in the room is a running total of these, so a short estimate compounds
 *  down the queue and the singer who was told "ten minutes" is still sitting
 *  down when their name comes up; five seconds long, once, does nothing.
 *
 *  A player that cannot hear the room skips metering entirely and the row runs
 *  thirty-five seconds shorter than this. Same trade, same direction. */
const BATTLE_OVERHEAD_SECS = (
  BATTLE_LOGO_MS + BATTLE_VERSUS_MS + (BATTLE_INTRO_MS * 2)
  + BATTLE_JUDGE_MS + (BATTLE_METER_MS * 2) + BATTLE_WINNER_MS
) / 1000

const BATTLE_SING_SECS = BATTLE_SING_MS / 1000

/**
 * How long a queue row holds the stage, or null when we cannot say.
 *
 * A battle is one row and two performances. Read as an ordinary row — which is
 * exactly what QueueItem is designed to allow — it looks like one song of
 * three minutes, when it is closer to five and a half. Every wait in the room
 * is a running total of these, so one uncounted battle makes every estimate
 * behind it short, and the singer who was told "ten minutes" is still sitting
 * down when their name comes up.
 */
const getItemSecs = (item: QueueItem, songs: RootState['songs']): number | null => {
  const song = songs.entities[item.songId]

  // a trivia round has songId 0 and lands here too: no song, no duration, and
  // the caller skips the row entirely rather than guessing at one
  if (!song) return null
  if (!isBattleItem(item)) return song.duration

  const opponentSong = songs.entities[item.opponentSongId]

  return Math.min(song.duration, BATTLE_SING_SECS)
    // The library may not hold the opponent's song on this device — the phone
    // fetches songs by artist and a battle can reach outside what it has. The
    // cap is the honest guess there: it is what the beat is allowed to take.
    + Math.min(opponentSong ? opponentSong.duration : BATTLE_SING_SECS, BATTLE_SING_SECS)
    + BATTLE_OVERHEAD_SECS
}

const getWaits = createSelector(
  [getQueue, getQueueId, getPlayerHistory, getPosition, getSongs],
  (queue, queueId, history, position, songs) => {
    const curIdx = queue.result.indexOf(queueId)
    const waits: Record<number, number> = {}
    let curWait = 0
    let nextWait = 0

    queue.result.forEach((queueId, i) => {
      const secs = getItemSecs(queue.entities[queueId], songs)
      if (secs === null) return

      if (i === curIdx) {
        // if history includes the current item it's already been played
        if (history.lastIndexOf(queueId) === -1) {
          // `position` is how far into the *current media* the player is, so
          // on a battle this over-counts by however much of the first song is
          // already behind us. Left as is: it decays to correct as the row
          // finishes, and the alternative is teaching this selector which of
          // the ten beats is on screen, which is the player's business.
          nextWait = Math.round(secs - position)
        }
      } else if (i > curIdx) {
        // upcoming
        curWait += nextWait
        nextWait = secs
      }

      waits[queueId] = curWait
    })

    return waits
  },
)

export default getWaits
