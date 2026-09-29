import { describe, expect, it } from 'vitest'
import { PLAYER_STATUS } from 'shared/actionTypes'
import statusReducer from './status'

describe('the TV status on a phone', () => {
  it('drops a lead-in the TV stopped sending, rather than keeping the last one', () => {
    const counting = statusReducer(undefined, {
      type: PLAYER_STATUS,
      payload: { isPlaying: true, leadInEndsAt: 5000, leadInQueueId: 7 },
    })

    expect(counting).toMatchObject({ leadInEndsAt: 5000, leadInQueueId: 7 })

    // JSON drops undefined, so an ended lead-in arrives as missing keys
    const sung = statusReducer(counting, { type: PLAYER_STATUS, payload: { isPlaying: true } })

    expect(sung.leadInEndsAt).toBeUndefined()
    expect(sung.leadInQueueId).toBeUndefined()
    expect(sung.isPlaying).toBe(true)
  })
})
