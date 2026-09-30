import type { BattlePhase, BattleSide, QueueItem } from 'shared/types'
import battleVideoRect, { type BattleVideoRect } from '../PlayerBattle/battleVideoRect'

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
 * Video keying resolves like everything else: each half from its own file's
 * folder. It used to be forced off in a battle, because keying then drew a
 * darkened, blurred backdrop behind the picture and one fighter's song came up
 * dim beside the other's. A keyed song now wears nothing behind its lyrics but
 * the singer's own stage (see mediaStage), in a battle's hole as on an
 * ordinary song, so a battle half plays exactly as that song would on its own.
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
      isVideoKeyingEnabled: !!queueItem.opponentIsVideoKeyingEnabled,
    }
  }

  return {
    key: queueItem.queueId,
    mediaId: queueItem.mediaId,
    mediaType: queueItem.mediaType,
    keyChange: queueItem.keyChange,
    rgTrackGain: queueItem.rgTrackGain,
    rgTrackPeak: queueItem.rgTrackPeak,
    isVideoKeyingEnabled: queueItem.isVideoKeyingEnabled,
  }
}

/**
 * Whether the media plays and is drawn. It never covers the whole stage any
 * more: an ordinary song sits in the 11b frame on its singer's stage
 * (songVideoRect), and a battle's in the bezel's hole.
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

/**
 * 11b · where an ordinary song's video sits: the design's 764x430 frame at
 * (168, 84) on its 960x540 TV, scaled to the player's box.
 */
export function songVideoRect (width: number, height: number): BattleVideoRect {
  return {
    left: width * 168 / 960,
    top: height * 84 / 540,
    width: width * 764 / 960,
    height: height * 430 / 540,
  }
}

/**
 * Whether a song's media has its background knocked out, so 11b's black box
 * and amber frame come off and the singer's club stage shows through behind
 * the lyrics. Keying is the path's "Video keying" pref: an MP4 is keyed by the
 * WebGL player (MP4AlphaPlayer), so it needs WebGL; a CD+G draws on a clear
 * canvas already and, keyed, drops its tinted backdrop too (CDGPlayer), so the
 * pref alone decides. Anything not keyed keeps the frame: an opaque video in a
 * frameless box is just a video with its edges missing.
 */
export function isKnockedOut (media: Pick<StageMedia, 'mediaType' | 'isVideoKeyingEnabled'>, isWebGLSupported: boolean): boolean {
  if (!media.isVideoKeyingEnabled) return false
  return media.mediaType === 'cdg' || (media.mediaType === 'mp4' && isWebGLSupported)
}

/**
 * Where the media plays and what stands behind it: one answer for an ordinary
 * song and for either half of a battle, so the two can never drift apart.
 *
 * - rect: 11b's frame for a song, the bezel's hole for a battle half (the
 *   whole display when nothing is on stage; PlayerFrame explains why the box
 *   always exists).
 * - singer: whose club stage stands behind the media, which is what keyed
 *   lyrics sit on. The row's singer for a song; for a battle half, the
 *   fighter that half picked, falling back to their account's.
 * - backdropRect: where that stage is drawn. Full bleed under a song; under a
 *   battle half, exactly the battle's own 16:9 box (PlayerBattle's Stage), or
 *   the stage seen through the hole and the plate's copy of it round the hole
 *   are scaled differently and meet in a visible seam on any screen that is
 *   not exactly 16:9.
 * - frame: what is drawn around opaque media — 11b's amber frame on a song,
 *   the bezel round the hole on a battle half (13e/13g). Keyed media wears
 *   neither: the singer's stage behind it is the point.
 */
export function mediaStage ({ queueItem, battleSide, isMediaVisible, isBattleRow, isWebGLSupported, width, height }: {
  queueItem?: QueueItem
  battleSide: BattleSide | null
  isMediaVisible: boolean
  isBattleRow: boolean
  isWebGLSupported: boolean
  width: number
  height: number
}): { rect: BattleVideoRect | null, backdropRect: BattleVideoRect | null, singer: string | null | undefined, frame: 'song' | 'bezel' | null } {
  if (battleSide && queueItem) {
    // PlayerBattle's Stage: as wide as fits at 16:9, centred
    const boxWidth = Math.min(width, Math.round(height * 16 / 9))
    const boxHeight = boxWidth * 9 / 16

    return {
      rect: battleVideoRect(width, height, battleSide),
      backdropRect: { left: (width - boxWidth) / 2, top: (height - boxHeight) / 2, width: boxWidth, height: boxHeight },
      singer: battleSide === 1
        ? queueItem.singerId ?? queueItem.userAvatarId
        : queueItem.opponentSingerId ?? queueItem.opponentAvatarId,
      frame: isKnockedOut(resolveMedia(queueItem, battleSide), isWebGLSupported) ? null : 'bezel',
    }
  }

  if (!isMediaVisible || isBattleRow || !queueItem) return { rect: null, backdropRect: null, singer: undefined, frame: null }

  return {
    rect: songVideoRect(width, height),
    backdropRect: null,
    singer: queueItem.userAvatarId,
    frame: isKnockedOut(resolveMedia(queueItem, null), isWebGLSupported) ? null : 'song',
  }
}
