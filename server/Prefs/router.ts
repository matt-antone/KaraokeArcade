import fs from 'fs'
import path from 'path'
import getLogger from '../lib/Log.js'
import KoaRouter from '@koa/router'
import { requireAdmin } from '../lib/util.js'
import getFolders from '../lib/getFolders.js'
import getWindowsDrives from '../lib/getWindowsDrives.js'
import getServerUrl from '../lib/getServerUrl.js'
import fighterSets from './fighterSets.js'
import Prefs from './Prefs.js'
import Media from '../Media/Media.js'
import pushQueuesAndLibrary from '../lib/pushQueuesAndLibrary.js'
import Rooms from '../Rooms/Rooms.js'
import Queue from '../Queue/Queue.js'
import { PREFS_PATHS_CHANGED, QUEUE_PUSH } from '../../shared/actionTypes.js'
import type { Prefs as PrefsType } from '../../shared/types.js'

interface RequestWithBody {
  body: Record<string, unknown>
}

const log = getLogger('Prefs')

const router = new KoaRouter({ prefix: '/api/prefs' })

/**
 * All prefs, with each media path's song count merged in from the real
 * media/path relationship (rather than tracked separately and going stale).
 */
// get all prefs (including media paths)
router.get('/', (ctx) => {
  const prefs = Prefs.get() as unknown as PrefsType

  // must be admin or firstrun
  if (prefs.isFirstRun || ctx.user.isAdmin) {
    // The join URL a phone can actually reach. The player builds its QR from
    // this rather than from its own address bar: a host who opened the player
    // at localhost would otherwise encode localhost, and every phone that
    // scanned it would be pointed at itself.
    ctx.body = { ...prefs, serverUrl: getServerUrl(ctx.request.host.split(':')[1]) }
    return
  }

  // non-admins only get roles
  ctx.body = { roles: prefs.roles }
})

// Battle fighter groups as { group: { slug: { set: {frames, fps, columns} } } }:
// every folder under assets/battle/fighters, every fighter folder in it that
// has its key art, and how each of that fighter's sets is cut and played.
//
// The numbers ride along with the listing rather than being fetched per
// fighter because this walk is already opening every fighter's folder, and
// because the stage resolves a fighter from an id on a queue row — it never
// visits the chooser, so a second request keyed on the chooser would leave it
// drawing a 24-frame dance as sixteen.
//
// Anyone in a room picks a fighter, so this is not admin-only.
router.get('/fighters', async (ctx) => {
  if (!ctx.user.userId) ctx.throw(401)

  const root = path.join(ctx.assetsPath, 'battle', 'fighters')
  const dirs = async (dir: string) => (await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []))
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()

  const groups: Record<string, Record<string, Awaited<ReturnType<typeof fighterSets>>>> = {}

  for (const group of await dirs(root)) {
    const slugs = (await dirs(path.join(root, group)))
      .filter(slug => fs.existsSync(path.join(root, group, slug, 'views', 'key.png')))

    if (!slugs.length) continue

    groups[group] = Object.fromEntries(await Promise.all(
      slugs.map(async slug => [slug, await fighterSets(path.join(root, group, slug))] as const),
    ))
  }

  ctx.body = groups
})

// add a media path
router.post('/path', requireAdmin, (ctx) => {
  const dir = decodeURIComponent(ctx.query.dir as string)

  // required
  if (!dir) {
    ctx.throw(422, 'Invalid path')
  }

  const pathId = Prefs.addPath(dir, {
    prefs: (ctx.request as unknown as RequestWithBody).body,
  })

  // respond with updated prefs
  const prefs = Prefs.get() as unknown as PrefsType
  ctx.body = prefs

  // (re)start watcher
  process.emit(PREFS_PATHS_CHANGED, prefs.paths)

  ctx.startScanner(pathId)
})

// set media path preferences
router.put('/path/:pathId', requireAdmin, (ctx) => {
  const pathId = parseInt(ctx.params.pathId, 10)

  if (isNaN(pathId)) {
    ctx.throw(422, 'Invalid pathId')
  }

  Prefs.setPathData(pathId, 'prefs.', (ctx.request as unknown as RequestWithBody).body)

  // respond with updated prefs
  const prefs = Prefs.get() as unknown as PrefsType
  ctx.body = prefs

  // (re)start watcher?
  if ('isWatchingEnabled' in (ctx.request as unknown as RequestWithBody).body) {
    process.emit(PREFS_PATHS_CHANGED, prefs.paths)
  }

  // need to push updated queue items?
  if ('isVideoKeyingEnabled' in (ctx.request as unknown as RequestWithBody).body) {
    for (const { room, roomId } of Rooms.getActive(ctx.io)) {
      ctx.io.to(room).emit('action', {
        type: QUEUE_PUSH,
        payload: Queue.get(roomId),
      })
    }
  }
})

// remove a media path
router.delete('/path/:pathId', requireAdmin, (ctx) => {
  const pathId = parseInt(ctx.params.pathId, 10)

  if (isNaN(pathId)) {
    ctx.throw(422, 'Invalid pathId')
  }

  ctx.stopScanner()

  Prefs.removePath(pathId)

  // respond with updated prefs
  const prefs = Prefs.get() as unknown as PrefsType
  ctx.body = prefs

  // (re)start watcher
  process.emit(PREFS_PATHS_CHANGED, prefs.paths)

  Media.cleanup()

  pushQueuesAndLibrary(ctx.io)
})

// scan a media path
router.get('/path/:pathId/scan', requireAdmin, async (ctx) => {
  const pathId = parseInt(ctx.params.pathId, 10)

  if (isNaN(pathId)) {
    ctx.throw(422, 'Invalid pathId')
  }

  ctx.status = 200
  ctx.startScanner(pathId)
})

// scan all media paths
router.get('/paths/scan', requireAdmin, async (ctx) => {
  ctx.status = 200
  ctx.startScanner(true)
})

// stop scanning
router.get('/paths/scan/stop', requireAdmin, async (ctx) => {
  ctx.status = 200
  ctx.stopScanner()
})

// get folder listing for path browser
router.get('/path/ls', requireAdmin, async (ctx) => {
  const dir = decodeURIComponent(ctx.query.dir as string)

  // windows is a special snowflake and gets an
  // extra top level of available drive letters
  if (dir === '' && process.platform === 'win32') {
    const drives = getWindowsDrives()

    ctx.body = {
      current: '',
      parent: false,
      children: drives,
    }
  } else {
    const current = path.resolve(dir)
    const parent = path.resolve(dir, '../')

    const list = await getFolders(dir)
    log.verbose('%s listed path: %s', ctx.user.name, current)

    ctx.body = {
      current,
      // if at root, windows gets a special top level
      parent: parent === current ? (process.platform === 'win32' ? '' : false) : parent,
      children: list.map(p => ({
        path: p,
        label: p.replace(current + path.sep, ''),
      })).filter(c => !(c.label.startsWith('.') || c.label.startsWith('/.'))),
    }
  }
})

export default router
