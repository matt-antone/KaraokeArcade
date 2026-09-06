import fs from 'fs'
import fsPromises from 'node:fs/promises'
import { Readable } from 'stream'
import path from 'path'
import { unzip } from 'unzipit'
import getLogger from '../lib/Log.js'
import getCdgName from '../lib/getCdgName.js'
import { getExt, requireAdmin } from '../lib/util.js'
import KoaRouter from '@koa/router'
import Media from './Media.js'
import Prefs from '../Prefs/Prefs.js'
import fileTypes from './fileTypes.js'
const log = getLogger('Media')
const router = new KoaRouter({ prefix: '/api/media' })

const audioExts = Object.keys(fileTypes).filter(ext => fileTypes[ext].mimeType.startsWith('audio/'))

// stream a media file
/** What a request is asking for out of a packed CDG archive. The audio and the
 *  graphics live in the same .zip, so which one comes back is the query's
 *  `type` — and only the archive root is looked at, never a folder inside it. */
async function fromArchive (ctx, file: string, type: string) {
  const { entries } = await unzip(new Uint8Array(await fsPromises.readFile(file)))
  const rootNames = Object.keys(entries).filter(f => !f.includes('/'))

  const entry = type === 'cdg'
    ? rootNames.find(f => getExt(f) === '.cdg')
    : rootNames.find(f => audioExts.includes(getExt(f)))

  if (!entry) {
    ctx.throw(404, type === 'cdg' ? 'No .cdg file found in archive' : 'No valid audio file found in archive')
  }

  return {
    file,
    buffer: Buffer.from(await entries[entry].arrayBuffer()),
    length: entries[entry].size,
    mimeType: fileTypes[getExt(entry)]?.mimeType,
  }
}

/** The same two things as loose files, where the .cdg is a sidecar sitting
 *  beside the audio rather than packed with it. Streamed from disk rather than
 *  read into memory — these are whole songs. */
async function fromDisk (ctx, audioFile: string, type: string) {
  let file = audioFile

  if (type === 'cdg') {
    const cdg = getCdgName(file)
    if (!cdg) ctx.throw(404, 'The .cdg file could not be found')
    file = cdg as string
  }

  return {
    file,
    buffer: undefined,
    length: (await fsPromises.stat(file)).size,
    mimeType: fileTypes[getExt(file)]?.mimeType,
  }
}

router.get('/:mediaId', requireAdmin, async (ctx) => {
  const { type } = ctx.query

  const mediaId = parseInt(ctx.params.mediaId, 10)

  if (Number.isNaN(mediaId) || !type) {
    ctx.throw(422, 'invalid mediaId or type')
  }

  // get media info
  const res = Media.search({ mediaId })

  if (!res.result.length) {
    ctx.throw(404, 'mediaId not found')
  }

  const { pathId, relPath } = res.entities[mediaId]

  // get base path
  const { paths } = Prefs.get()
  const basePath = paths.entities[pathId].path

  const packed = path.join(basePath, relPath)

  const { file, buffer, length, mimeType } = getExt(packed) === '.zip'
    ? await fromArchive(ctx, packed, type as string)
    : await fromDisk(ctx, packed, type as string)

  ctx.length = length
  ctx.type = mimeType

  if (!ctx.type) ctx.throw(404, `Unknown MIME type: ${file}`)

  log.verbose('streaming %s (%sMB): %s', ctx.type, (ctx.length / 1000000).toFixed(2), file)
  ctx.body = buffer ? Readable.from(buffer) : fs.createReadStream(file)
})

export default router
