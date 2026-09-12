import { describe, it, expect } from 'vitest'
import publicRoomPrefs from './publicPrefs.js'
import type { IRoomPrefs } from '../../shared/types.js'

/**
 * What a room tells the people in it about itself.
 *
 * Both directions of this have already been got wrong once, and neither failure
 * announces itself. Too little and a feature is silently dead for everybody who
 * is not an admin — the Battle key read a pref that never reached the phone and
 * drew itself as switched off, which looks exactly like the setting being off.
 * Too much and the room password walks out in the join QR's prefs.
 */

const full = (): IRoomPrefs => ({
  qr: { isEnabled: true, opacity: 1, password: 'hunter2', size: 4 },
  trivia: { isEnabled: true, countdownSeconds: 20 },
  battle: { isEnabled: true, judging: 'ballot' },
  user: { isNewAllowed: true, isGuestAllowed: true },
  roles: { 3: { allowNew: true }, 4: { allowNew: true } },
})

describe('the prefs a non-admin may see', () => {
  it('never lets the room password out', () => {
    // The one that matters. prefs.qr.password is the room password the join QR
    // embeds; anyone already in the room holding it can invite strangers past
    // a password they were never told.
    const out = publicRoomPrefs(full())

    expect(out.qr).toBeUndefined()
    expect(JSON.stringify(out)).not.toContain('hunter2')
  })

  it('passes the two keys a phone actually draws', () => {
    const out = publicRoomPrefs(full())

    expect(out.roles).toEqual({ 3: { allowNew: true }, 4: { allowNew: true } })
    expect(out.battle).toEqual({ isEnabled: true, judging: 'ballot' })
  })

  it('keeps everything else out by default', () => {
    // A whitelist, so a key added to IRoomPrefs tomorrow is private until
    // somebody decides otherwise here — rather than shipping the moment it is
    // declared.
    expect(Object.keys(publicRoomPrefs(full())).sort()).toEqual(['battle', 'roles'])
  })

  it('says nothing about a room that has never been configured', () => {
    // An upgraded install has no prefs at all, and must not sprout an empty
    // battle key that reads as a decision somebody made.
    expect(publicRoomPrefs(undefined)).toEqual({})
    expect(publicRoomPrefs({} as IRoomPrefs)).toEqual({})
  })

  it('omits a key rather than sending an undefined one', () => {
    const out = publicRoomPrefs({ roles: { 3: { allowNew: true } } } as IRoomPrefs)

    expect('battle' in out).toBe(false)
  })
})
