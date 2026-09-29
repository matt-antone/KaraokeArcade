import { describe, expect, it } from 'vitest'
import { ordinal } from './ordinal'

describe('ordinal', () => {
  it('reads a standing as a place, teens included', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal))
      .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st'])
  })
})
