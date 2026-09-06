import path from 'path'
import fsPromises from 'node:fs/promises'
import { parseBuffer } from 'music-metadata'
import { unzip } from 'unzipit'
import getLogger from '../../lib/Log.js'
import { getExt } from '../../lib/util.js'
import getFiles from './getFiles.js'
import getConfig from './getConfig.js'
import getCdgName from '../../lib/getCdgName.js'
import Media from '../../Media/Media.js'
import MetaParser from '../MetaParser/MetaParser.js'
import Scanner from '../Scanner.js'
import IPC from '../../lib/IPCBridge.js'
import fileTypes from '../../Media/fileTypes.js'
import { LIBRARY_MATCH_SONG, MEDIA_ADD, MEDIA_REMOVE, MEDIA_UPDATE } from '../../../shared/actionTypes.js'
const log = getLogger('FileScanner')

const audioExts = Object.keys(fileTypes).filter(ext => fileTypes[ext].mimeType.startsWith('audio/'))
const searchExts = Object.keys(fileTypes).filter(ext => fileTypes[ext].scan !== false)

/**
 * The audio to read tags from, and what kind it is.
 *
 * A .zip is a CDG pair packed together, so the audio has to come out of the
 * archive before anything can be parsed; every other kind is the file itself,
 * and only has to be checked for the sidecar it claims to need.
 */
async function readAudio (file: string): Promise<{ buffer: Buffer, mimeType: string }> {
  const buffer = await fsPromises.readFile(file)

  if (getExt(file) !== '.zip') {
    if (fileTypes[getExt(file)].requiresCDG && !(getCdgName(file))) throw new Error('no .cdg sidecar found')

    return { buffer, mimeType: fileTypes[getExt(file)].mimeType }
  }

  const { entries } = await unzip(new Uint8Array(buffer))
  // only the archive root: a folder inside it is somebody else's business
  const rootNames = Object.keys(entries).filter(f => !f.includes('/'))

  const audioName = rootNames.find(f => audioExts.includes(getExt(f)))
  if (!audioName) throw new Error(`no valid audio file ${JSON.stringify(audioExts)} found in archive`)

  if (!rootNames.some(f => getExt(f) === '.cdg')) throw new Error('no .cdg sidecar found in archive')

  return {
    buffer: Buffer.from(await entries[audioName].arrayBuffer()),
    mimeType: fileTypes[getExt(audioName)].mimeType,
  }
}

/** A file already in the library: send only the columns that actually moved,
 *  so a rescan of an unchanged folder writes nothing. */
async function updateIfChanged (row: Record<string, unknown>, media: Record<string, unknown>): Promise<void> {
  const diff = {}

  for (const key of Object.keys(media)) {
    if (media[key] !== row[key]) diff[key] = media[key]
  }

  if (!Object.keys(diff).length) {
    log.info('  => ok')
    return
  }

  await (IPC as any).req({
    type: MEDIA_UPDATE,
    payload: {
      mediaId: row.mediaId,
      dateUpdated: Math.round(new Date().getTime() / 1000), // seconds
      ...diff,
    },
  })

  log.info('  => updated: %s', Object.keys(diff).join(', '))
}

class FileScanner extends Scanner {
  paths: any
  parser: any

  constructor (prefs, qStats) {
    super(qStats)
    this.paths = prefs.paths
  }

  async scan (pathId) {
    const dir = this.paths.entities[pathId]?.path
    const validMediaIds = []
    const stats = { new: 0, removed: 0, existing: 0 }
    let files // { file, stats }[]
    let prevDir

    if (!dir) {
      log.error('invalid pathId: %s', pathId)
      return stats
    }

    log.info('Searching: %s', dir)
    this.emitStatus(`Searching: ${dir}`, 0)

    try {
      files = getFiles(dir, file => searchExts.includes(getExt(file)))

      log.info('  => found %s files with valid extensions %s',
        files.length.toLocaleString(),
        JSON.stringify(searchExts),
      )
    } catch (err) {
      log.error(`  => ${err.message} (path offline)`)
      return stats
    }

    for (let i = 0; i < files.length; i++) {
      const curDir = path.dirname(files[i].file)

      if (prevDir !== curDir) {
        prevDir = curDir

        // (re)init parser with this folder's config, if any
        const cfg = getConfig(curDir, dir)
        this.parser = MetaParser(cfg)
      }

      log.info('[%s/%s] %s', i + 1, files.length, files[i].file)
      this.emitStatus(`Scanning (${i + 1} of ${files.length})`, (i + 1) / files.length)

      // process file
      try {
        const res = await this.process(files[i], pathId)
        validMediaIds.push(res.mediaId)

        if (res.isNew) stats.new++
        else stats.existing++
      } catch (err) {
        log.warn(`  => ${err.message}`)
      }

      if (this.isCanceling) {
        this.emitStatus('Stopped', 100, false)
        return stats
      }
    } // end for

    log.info('Scanned %s valid media files', validMediaIds.length.toLocaleString())
    log.info('Searching for invalid media entries')

    const numRemoved = await this.removeInvalid(pathId, validMediaIds)
    stats.removed = numRemoved
    log.info(`Removed ${numRemoved} invalid media entries`)

    return stats
  }

  async process ({ file }, pathId) {
    const { buffer, mimeType } = await readAudio(file)

    const data = await parseBuffer(buffer, mimeType, {
      duration: true,
      skipCovers: true,
    })

    if (!data.format.duration) {
      throw new Error('could not determine duration')
    }

    log.verbose('  => duration: %s:%s',
      Math.floor(data.format.duration / 60),
      Math.round(data.format.duration % 60).toString().padStart(2, '0'),
    )

    // run MetaParser
    const pathInfo = path.parse(file)
    const parsed = this.parser({
      dir: pathInfo.dir,
      dirSep: path.sep,
      name: pathInfo.name,
      meta: data.common,
    })

    // get artistId and songId
    const match = await (IPC as any).req({ type: LIBRARY_MATCH_SONG, payload: parsed })

    const media = {
      songId: match.songId,
      pathId,
      // normalize relPath to forward slashes with no leading slash
      relPath: file.substring(this.paths.entities[pathId].path.length).replace(/\\/g, '/').replace(/^\//, ''),
      duration: Math.round(data.format.duration),
      rgTrackGain: data.common.replaygain_track_gain ? data.common.replaygain_track_gain.dB : null,
      rgTrackPeak: data.common.replaygain_track_peak ? data.common.replaygain_track_peak.ratio : null,
    }

    // file already in database?
    const res = Media.search({
      pathId,
      relPath: media.relPath,
    })

    log.verbose('  => %s db result(s)', res.result.length)

    if (res.result.length) {
      const row = res.entities[res.result[0]]

      await updateIfChanged(row, media)

      return { mediaId: row.mediaId, isNew: false }
    } // end if

    // new media
    ;(media as any).dateAdded = Math.round(new Date().getTime() / 1000) // seconds
    log.info('  => new: %s', JSON.stringify(match))

    return {
      mediaId: await (IPC as any).req({ type: MEDIA_ADD, payload: media }),
      isNew: true,
    }
  }

  async removeInvalid (pathId, validMediaIds = []) {
    const res = Media.search({ pathId })
    const invalid = res.result.filter(mediaId => !validMediaIds.includes(mediaId))

    if (invalid.length) {
      await (IPC as any).req({ type: MEDIA_REMOVE, payload: invalid })
    }

    return invalid.length
  }
}

export default FileScanner
