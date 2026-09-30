import { describe, expect, it } from 'vitest'
import { NO_MEDIA, getBattleSide, getIsMediaVisible, getIsRowOnStage, isKnockedOut, mediaStage, resolveMedia, songVideoRect } from './playerStage'
import type { QueueItem } from 'shared/types'
import battleVideoRect from '../PlayerBattle/battleVideoRect'

/**
 * The three decisions where being wrong is silent.
 *
 * A battle row is deliberately readable as an ordinary queue row, which is what
 * makes resolveMedia dangerous: every field has a plausible value on both
 * halves, so picking the wrong half plays the challenger's song twice and
 * nothing anywhere complains. The opponent stands at the microphone with the
 * wrong words on the screen, and that is the first anyone knows.
 */

const battleRow = {
  queueId: 42,
  mediaId: 1,
  mediaType: 'cdg',
  keyChange: 3,
  rgTrackGain: -6,
  rgTrackPeak: 0.9,
  isVideoKeyingEnabled: false,
  opponentMediaId: 2,
  opponentMediaType: 'mp4',
  opponentKeyChange: 0,
  opponentRgTrackGain: -2,
  opponentRgTrackPeak: 0.5,
  opponentIsVideoKeyingEnabled: true,
} as unknown as QueueItem

describe('getBattleSide', () => {
  it('names the fighter whose song is playing', () => {
    expect(getBattleSide(true, 'sing1')).toBe(1)
    expect(getBattleSide(true, 'sing2')).toBe(2)
  })

  it.each(['versus', 'intro1', 'intro2', 'judge', 'meter1', 'meter2', 'winner'] as const)(
    'is nobody on the %s beat', (phase) => {
      expect(getBattleSide(true, phase)).toBeNull()
    })

  // an expired sing1 must stop playing, not run on into the intro that follows
  it('is nobody once the beat has expired', () => {
    expect(getBattleSide(true, null)).toBeNull()
  })

  it('is nobody when the battle on stage is somebody else\'s row', () => {
    expect(getBattleSide(false, 'sing1')).toBeNull()
  })
})

describe('resolveMedia', () => {
  it('plays the row\'s own song for an ordinary row', () => {
    expect(resolveMedia(battleRow, null)).toMatchObject({
      key: 42, mediaId: 1, mediaType: 'cdg', keyChange: 3, rgTrackGain: -6, rgTrackPeak: 0.9,
    })
  })

  it('plays the challenger\'s song on sing1', () => {
    expect(resolveMedia(battleRow, 1)?.mediaId).toBe(1)
  })

  // the whole reason this function exists
  it('plays the opponent\'s own file, format and gain on sing2', () => {
    expect(resolveMedia(battleRow, 2)).toMatchObject({
      mediaId: 2,
      mediaType: 'mp4',
      keyChange: 0,
      rgTrackGain: -2,
      rgTrackPeak: 0.5,
    })
  })

  // Keying is a property of the folder each file was scanned from, and each
  // half plays as its song would on its own: keyed lyrics on that fighter's
  // stage, an unkeyed picture as it is (see mediaStage)
  it('keys each fighter by their own song\'s folder', () => {
    expect(resolveMedia(battleRow, 1).isVideoKeyingEnabled).toBe(false)
    expect(resolveMedia(battleRow, 2).isVideoKeyingEnabled).toBe(true)
  })

  it('leaves keying alone on an ordinary row', () => {
    const keyed = { ...battleRow, isVideoKeyingEnabled: true } as unknown as QueueItem

    expect(resolveMedia(keyed, null).isVideoKeyingEnabled).toBe(true)
  })

  // a media component reloads only when the key changes, and one queue row is
  // one queueId — so the two halves must not share one
  it('gives the two halves different media keys', () => {
    expect(resolveMedia(battleRow, 1)?.key).not.toBe(resolveMedia(battleRow, 2)?.key)
  })

  it('keeps the key a number belonging to this row', () => {
    expect(Math.abs(resolveMedia(battleRow, 2)!.key)).toBe(battleRow.queueId)
  })

  // Player takes nulls and knows what they mean, so there is nothing for the
  // render to test seven times over
  it('resolves to nothing playable with no row', () => {
    expect(resolveMedia(undefined, null)).toEqual(NO_MEDIA)
    expect(NO_MEDIA.mediaId).toBeNull()
  })
})

describe('getIsMediaVisible', () => {
  const playing: Parameters<typeof getIsMediaVisible>[0] = {
    queueItem: battleRow,
    isTriviaRow: false,
    isErrored: false,
    isAtQueueEnd: false,
    intermissionEndsAt: null,
    isBattleRow: false,
    battleSide: null,
  }

  it('shows an ordinary song', () => {
    expect(getIsMediaVisible(playing)).toBe(true)
  })

  it.each([
    ['there is no row', { queueItem: undefined }],
    ['the row is a trivia round', { isTriviaRow: true }],
    ['the media failed', { isErrored: true }],
    ['the queue has run out', { isAtQueueEnd: true }],
    ['an intermission is running', { intermissionEndsAt: 1 }],
  ])('stands down when %s', (_, override) => {
    expect(getIsMediaVisible({ ...playing, ...override })).toBe(false)
  })

  // a battle shows media on two of its ten beats and an overlay on the rest
  it('shows a battle only while somebody is singing', () => {
    expect(getIsMediaVisible({ ...playing, isBattleRow: true, battleSide: null })).toBe(false)
    expect(getIsMediaVisible({ ...playing, isBattleRow: true, battleSide: 1 })).toBe(true)
    expect(getIsMediaVisible({ ...playing, isBattleRow: true, battleSide: 2 })).toBe(true)
  })
})

describe('getIsRowOnStage', () => {
  it('gives a battle row the stage while the player is on it', () => {
    expect(getIsRowOnStage(true, false)).toBe(true)
  })

  /* The one that was shipped. handleLoadNext leaves queueId on the finished row
     when there is nothing to move to, so a battle last in the queue stays the
     current row for the rest of the night — and PlayerBattle, with no beat to
     draw, holds the display on the Singer Battle lockup and "Getting ready".
     The lead-in card is a screen for the front of a fight; here it was the last
     thing the room saw, with the end-of-queue page never getting the stage
     back. */
  it('takes it away once the queue has run out under it', () => {
    expect(getIsRowOnStage(true, true)).toBe(false)
  })

  it('never gives it to an ordinary song row', () => {
    expect(getIsRowOnStage(false, false)).toBe(false)
    expect(getIsRowOnStage(false, true)).toBe(false)
  })
})

describe('songVideoRect', () => {
  // 11b: the design's 764x430 frame at (168, 84) on its 960x540 TV
  it('places the video in the design\'s frame, scaled to the display', () => {
    expect(songVideoRect(1920, 1080)).toEqual({ left: 336, top: 168, width: 1528, height: 860 })
  })
})

describe('isKnockedOut', () => {
  it('takes the frame off keyed media, so the stage shows through', () => {
    expect(isKnockedOut({ mediaType: 'cdg', isVideoKeyingEnabled: true }, false)).toBe(true)
    expect(isKnockedOut({ mediaType: 'mp4', isVideoKeyingEnabled: true }, true)).toBe(true)
  })

  it('keeps the frame when keying is off', () => {
    expect(isKnockedOut({ mediaType: 'cdg', isVideoKeyingEnabled: false }, true)).toBe(false)
    expect(isKnockedOut({ mediaType: 'mp4', isVideoKeyingEnabled: false }, true)).toBe(false)
  })

  it('keeps it on an MP4 the browser cannot key (no WebGL)', () => {
    expect(isKnockedOut({ mediaType: 'mp4', isVideoKeyingEnabled: true }, false)).toBe(false)
  })
})

describe('mediaStage', () => {
  const at = { isWebGLSupported: true, width: 1920, height: 1080 }
  const song = { ...battleRow, userAvatarId: 'diva', singerId: null } as unknown as QueueItem
  const fight = {
    ...battleRow,
    userAvatarId: 'diva',
    singerId: 'belter',
    opponentAvatarId: 'idol',
    opponentSingerId: null,
  } as unknown as QueueItem

  it('plays a song in 11b\'s frame on its singer\'s stage', () => {
    expect(mediaStage({ ...at, queueItem: song, battleSide: null, isMediaVisible: true, isBattleRow: false }))
      .toEqual({ rect: songVideoRect(1920, 1080), backdropRect: null, singer: 'diva', frame: 'song' })
  })

  it('takes the frame off a keyed song', () => {
    const keyed = { ...song, isVideoKeyingEnabled: true } as unknown as QueueItem
    expect(mediaStage({ ...at, queueItem: keyed, battleSide: null, isMediaVisible: true, isBattleRow: false }).frame).toBeNull()
  })

  it('stands each battle half on its own fighter\'s stage, bezelled unless keyed', () => {
    const one = mediaStage({ ...at, queueItem: fight, battleSide: 1, isMediaVisible: true, isBattleRow: true })
    const two = mediaStage({ ...at, queueItem: fight, battleSide: 2, isMediaVisible: true, isBattleRow: true })

    expect(one.singer).toBe('belter') // the fighter picked for the battle
    expect(two.singer).toBe('idol') // no pick: their account's
    // the fixture's first half is unkeyed, its second keyed
    expect(one.frame).toBe('bezel')
    expect(two.frame).toBeNull()
    expect(one.rect).toEqual(battleVideoRect(1920, 1080, 1))
    expect(two.rect).toEqual(battleVideoRect(1920, 1080, 2))
  })

  it('has no stage between beats or with nothing playing', () => {
    expect(mediaStage({ ...at, queueItem: fight, battleSide: null, isMediaVisible: false, isBattleRow: true }))
      .toEqual({ rect: null, backdropRect: null, singer: undefined, frame: null })
    expect(mediaStage({ ...at, queueItem: song, battleSide: null, isMediaVisible: false, isBattleRow: false }).singer).toBeUndefined()
  })
})

describe('mediaStage backdrop box', () => {
  const fight = { ...battleRow, singerId: 'belter', userAvatarId: 'diva' } as unknown as QueueItem

  // the stage through the hole must be the plate's own 16:9 box, or the two
  // copies of the art meet in a seam on a screen that is not 16:9
  it('draws a battle half\'s stage in the battle\'s centred 16:9 box', () => {
    const { backdropRect } = mediaStage({ queueItem: fight, battleSide: 1, isMediaVisible: true, isBattleRow: true, isWebGLSupported: true, width: 1181, height: 700 })

    expect(backdropRect).toEqual({ left: 0, top: (700 - 1181 * 9 / 16) / 2, width: 1181, height: 1181 * 9 / 16 })
  })

  it('letterboxes it on a screen squarer than 16:9', () => {
    const { backdropRect } = mediaStage({ queueItem: fight, battleSide: 2, isMediaVisible: true, isBattleRow: true, isWebGLSupported: true, width: 1000, height: 1000 })

    expect(backdropRect).toEqual({ left: 0, top: (1000 - 562.5) / 2, width: 1000, height: 562.5 })
  })
})
