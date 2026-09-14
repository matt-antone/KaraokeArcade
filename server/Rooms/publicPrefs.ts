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
/* Partial in as well as out: every key below is guarded, and a room made
 * before a given pref existed simply does not carry it — an upgraded install
 * may have no `qr` block at all. Taking the full IRoomPrefs here would be a
 * type that lies about what reaches this function, and would force a cast at
 * every call site and in every test. */
export default function publicRoomPrefs (prefs: Partial<IRoomPrefs> | undefined): Partial<IRoomPrefs> {
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
