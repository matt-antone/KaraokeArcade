import type { BattlePhase, BattleSide, QueueItem } from 'shared/types'

/**
 * The decisions PlayerController makes about what is on the stage, apart from
 * the effects that act on them.
 *
 * They are here because being wrong about any of them is silent. A battle row
 * is deliberately readable as an ordinary one, so resolving its media off the
 * wrong half plays song one twice and nothing complains — nobody notices until
 * the second fighter is standing at the microphone with the wrong words on
 * screen. That is not a thing to leave untested inside a 600-line component.
 */

/** Which fighter is at the microphone right now, or null on the eight beats
 *  that are not somebody singing. Read from the *live* beat rather than the
 *  stored one on purpose: an expired sing1 must stop playing, not run on into
 *  the intro that follows it. */
export function getBattleSide (isOnStage: boolean, phase: BattlePhase | null): BattleSide | null {
  if (!isOnStage) return null
  if (phase === 'sing1') return 1
  if (phase === 'sing2') return 2

  return null
}

interface StageMedia {
  key: number | null
  mediaId: number | null
  mediaType: string | null
  keyChange: number
  rgTrackGain: number | null
  rgTrackPeak: number | null
  isVideoKeyingEnabled: boolean
}

/** Nothing to play. Its own value rather than an undefined the render has to
 *  test seven times over — Player takes nulls for all of these and knows what
 *  they mean. */
export const NO_MEDIA: StageMedia = {
  key: null,
  mediaId: null,
  mediaType: null,
  keyChange: 0,
  rgTrackGain: null,
  rgTrackPeak: null,
  isVideoKeyingEnabled: false,
}

/**
 * Which half of a battle row is at the microphone, resolved to one set of
 * media props.
 *
 * During sing2 every one of these has to come from the opponent* fields: it is
 * a different file, often in a different format, with its own replay gain. The
 * row's own mediaId/mediaType/rgTrack* describe the *challenger's* song, so
 * driving the media straight off the queue item plays song one twice.
 *
 * The key matters as much as the file. A media component reloads only when
 * mediaKey changes (componentDidUpdate), and one queue row is one queueId, so
 * both halves would share a key. The intro2 splash sits exactly between them
 * and drops isMediaVisible, which unmounts the component and makes
 * componentDidMount load the new sources unconditionally — but a distinct key
 * is what makes the *volume* right too: Player uses a changed mediaKey to hold
 * off applying the next song's replay gain until it plays. Negated rather than
 * invented so it stays one row's key, and stays a number.
 *
 * Video keying is the one prop a battle overrides rather than resolves. It is
 * a property of the *folder* a file was scanned from, so two fighters whose
 * songs live in different folders get different answers to it — and keying
 * swaps the plain MP4 player for the alpha one, which lays a blurred, darkened
 * backdrop behind the picture and turns the visualizer on behind that. Inside
 * the stage's bezel that is a television with its brightness pulled down on
 * one fighter's song and not the other's, decided by nothing either of them
 * did. The panel is a hole cut in the plate with a real player behind it: what
 * belongs in it is the video, at full brightness, both times.
 */
export function resolveMedia (queueItem: QueueItem | undefined, battleSide: BattleSide | null): StageMedia {
  if (!queueItem) return NO_MEDIA

  if (battleSide === 2) {
    return {
      key: -queueItem.queueId,
      mediaId: queueItem.opponentMediaId,
      mediaType: queueItem.opponentMediaType,
      keyChange: queueItem.opponentKeyChange,
      rgTrackGain: queueItem.opponentRgTrackGain,
      rgTrackPeak: queueItem.opponentRgTrackPeak,
      isVideoKeyingEnabled: false,
    }
  }

  return {
    key: queueItem.queueId,
    mediaId: queueItem.mediaId,
    mediaType: queueItem.mediaType,
    keyChange: queueItem.keyChange,
    rgTrackGain: queueItem.rgTrackGain,
    rgTrackPeak: queueItem.rgTrackPeak,
    isVideoKeyingEnabled: battleSide ? false : queueItem.isVideoKeyingEnabled,
  }
}

/**
 * Whether the media layer covers the stage. It covers it completely when it
 * does, and the thread field behind stops drawing.
 *
 * A battle row shows media on two of its ten beats and an overlay on the
 * other seven, so it is visible only while somebody is actually singing.
 */
export function getIsMediaVisible ({ queueItem, isTriviaRow, isErrored, isAtQueueEnd, intermissionEndsAt, isBattleRow, battleSide }: {
  queueItem?: QueueItem
  isTriviaRow: boolean
  isErrored: boolean
  isAtQueueEnd: boolean
  intermissionEndsAt: number | null
  isBattleRow: boolean
  battleSide: BattleSide | null
}): boolean {
  return !!queueItem && !isTriviaRow && !isErrored && !isAtQueueEnd
    && !intermissionEndsAt && (!isBattleRow || battleSide !== null)
}

/**
 * Whether the row still under the player is one the player is still on.
 *
 * At the end of the queue there is nothing to move to, so handleLoadNext sets
 * isAtQueueEnd and leaves queueId where it was: the finished row goes on being
 * the current one. That is harmless for a song, whose media is already gone,
 * and is not for the two row types that draw a screen of their own. They keep
 * answering "this row is mine" for the rest of the night — the battle stage
 * sits on its Singer Battle lockup, the trivia mark on its sting — and the
 * end-of-queue page, which is the one thing that should be up, never gets the
 * stage back. The lead-in card is a screen for the front of a row, and this is
 * what stops it being the last thing the room sees.
 */
export function getIsRowOnStage (isRowType: boolean, isAtQueueEnd: boolean): boolean {
  return isRowType && !isAtQueueEnd
}
