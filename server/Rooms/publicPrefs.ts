import type { IRoomPrefs } from '../../shared/types.js'

/**
 * The parts of a room's prefs everybody in it is allowed to see.
 *
 * A whitelist rather than a blacklist, because one of the keys is a secret:
 * `qr.password` is the room password embedded in the join QR, and handing that
 * to everyone already in the room would let any guest mint an invite to a
 * password-protected room. So the default is that nothing leaves, and a key
 * earns its way onto this list by being something a phone has to draw.
 *
 * Admins skip this entirely — they are the ones editing these settings, and the
 * room editor needs every field.
 *
 * Extracted from the route handler so it can be tested: the cost of getting
 * this wrong is either a leaked room password or a feature that is silently
 * dead for everybody who is not an admin, and neither shows up as a type error.
 */
export default function publicRoomPrefs (prefs: IRoomPrefs | undefined): Partial<IRoomPrefs> {
  if (!prefs) return {}

  return {
    // which kinds of account the sign-up form may offer
    ...(prefs.roles ? { roles: prefs.roles } : {}),
    // Whether the header's Battle key is live. Without this that key is dead
    // for every guest and standard account in the room — they are exactly the
    // people who are not admins, and the key reads this pref to decide whether
    // it can be pressed. ROOM_PREFS_PUSH does not cover it either: that is
    // emitted to admins only (server/Rooms/socket.ts).
    ...(prefs.battle ? { battle: prefs.battle } : {}),
  }
}
