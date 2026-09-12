import { describe, expect, it } from 'vitest'
import { NO_MEDIA, getBattleSide, getIsMediaVisible, resolveMedia } from './playerStage'
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
      isVideoKeyingEnabled: true,
    })
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
  const playing = {
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

  // a battle shows media on two of its nine beats and an overlay on the rest
  it('shows a battle only while somebody is singing', () => {
    expect(getIsMediaVisible({ ...playing, isBattleRow: true, battleSide: null })).toBe(false)
    expect(getIsMediaVisible({ ...playing, isBattleRow: true, battleSide: 1 })).toBe(true)
    expect(getIsMediaVisible({ ...playing, isBattleRow: true, battleSide: 2 })).toBe(true)
  })
})
