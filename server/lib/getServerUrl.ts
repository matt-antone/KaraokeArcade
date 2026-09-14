import getLogger from './Log.js'
import getIPAddress from './getIPAddress.js'

const log = getLogger('server')

/**
 * The address guests reach this server at — what the join QR encodes, and so
 * what any home-screen install is welded to.
 *
 * The fallback is http://<LAN IPv4>:<port><basePath>: the address guests scan,
 * which is not necessarily the one the host is looking at. Undefined when the
 * machine has no external IPv4, in which case the player falls back to its own
 * location.
 *
 * KES_SERVER_URL overrides it because a LAN IP is an address, not an identity.
 * A home-screen install freezes whatever URL it was added from, so an IP that
 * moves with the network — or with a DHCP lease at the same venue — leaves a
 * dead icon, and a standalone window has no address bar to recover through.
 * Point this at a name that follows the server between networks (a Bonjour
 * <host>.local, or a tunnel) and the QR, the install and the icon all agree.
 */
export default function getServerUrl (port?: string): string | undefined {
  // read the same source cli.ts does; importing cli here would run its parsing
  const override = process.env.KES_SERVER_URL?.trim()

  if (override) {
    let parsed: URL | undefined

    try {
      parsed = new URL(override)
    } catch {
      // reported below, with the same message as a wrong-scheme override
    }

    // new URL() accepts any "scheme:rest", so a bare "karaokearcade.local:8080"
    // parses happily with "karaokearcade.local:" as its scheme. Checking the
    // protocol is what actually rejects a host:port missing its scheme, which
    // would otherwise poison every join QR silently. href normalizes to a
    // trailing slash, matching the fallback's shape.
    if (parsed?.protocol === 'http:' || parsed?.protocol === 'https:') {
      return parsed.href
    }

    log.warn('Ignoring KES_SERVER_URL (%s): expected an http(s) URL, e.g. http://karaokearcade.local:8080', override)
  }

  const ip = getIPAddress()
  if (!ip) return undefined

  const basePath = (process.env.KES_URL_PATH || '/').replace(/\/?$/, '/')

  return `http://${ip}${!port || port === '80' ? '' : ':' + port}${basePath}`
}
