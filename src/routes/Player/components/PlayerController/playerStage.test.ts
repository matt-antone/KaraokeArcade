import { describe, expect, it } from 'vitest'
import { NO_MEDIA, getBattleSide, getIsMediaVisible, getIsRowOnStage, resolveMedia } from './playerStage'
import type { QueueItem } from 'shared/types'

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

  // Keying is a property of the folder a file was scanned from, so two
  // fighters can disagree about it through no doing of their own — and the
  // side that has it on gets the alpha player's blurred, darkened backdrop
  // inside the bezel while the other side gets a plain picture. Off on both
  // halves, whatever the folders say.
  it('plays both fighters unkeyed, whatever their folders say', () => {
    const keyed = { ...battleRow, isVideoKeyingEnabled: true } as unknown as QueueItem

    expect(resolveMedia(keyed, 1).isVideoKeyingEnabled).toBe(false)
    expect(resolveMedia(keyed, 2).isVideoKeyingEnabled).toBe(false)
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

  it('covers the stage for an ordinary song', () => {
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
