import { describe, expect, it } from 'vitest'
import { chooseInterlude } from './party.js'

describe('alternating room games', () => {
  it('starts with Spot Trivia and alternates with Name That Karaoke', () => {
    expect(chooseInterlude(true, true, null)).toBe('spot')
    expect(chooseInterlude(true, true, 'spot')).toBe('name')
    expect(chooseInterlude(true, true, 'name')).toBe('spot')
  })
  it('uses the eligible game and schedules nothing with both off', () => {
    for (const last of [null, 'spot', 'name'] as const) {
      expect(chooseInterlude(false, false, last)).toBeNull()
      expect(chooseInterlude(true, false, last)).toBe('spot')
      expect(chooseInterlude(false, true, last)).toBe('name')
    }
  })
})
