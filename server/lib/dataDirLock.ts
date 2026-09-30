import fs from 'fs'
import path from 'path'
import { setTimeout as sleep } from 'timers/promises'

/** Waiting out a restart, not a running server: `tsx watch` and most process
 *  managers spawn the replacement before the old one has finished exiting, and
 *  refusing to start in that window would break the dev loop. Three seconds is
 *  long enough for a shutdown and far short of a party's patience. */
const RETRY_MS = 250
const RETRIES = 12

/**
 * Claim a data directory for this process, or refuse to start.
 *
 * Two servers sharing one database look fine for a while and then quietly ruin
 * a room: a trivia round lives in memory, per process, but the queue row it
 * marks played is written to the shared file. The server nobody is watching
 * spends the rounds, and the player shows an empty stage with no error
 * anywhere. Ports do not collide in that setup — the data directory is the
 * resource actually being shared, so that is what gets the lock.
 *
 * Returns the release function; call it on shutdown.
 */
export default async function claimDataDir (dataDir: string): Promise<() => void> {
  const lockFile = path.join(dataDir, 'server.pid')

  // first run on a machine: nothing has created the data dir yet, and the lock
  // is claimed before the database that would otherwise create it
  fs.mkdirSync(dataDir, { recursive: true })

  for (let attempt = 0; ; attempt++) {
    try {
      // 'wx' fails rather than truncates when the file is already there, which
      // is what makes the claim atomic between two servers starting at once
      fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' })
      return () => fs.rmSync(lockFile, { force: true })
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
    }

    const holder = Number(fs.readFileSync(lockFile, 'utf8').trim())

    // left behind by a crash or a kill -9; nothing is holding the directory
    if (!isRunning(holder)) {
      fs.rmSync(lockFile, { force: true })
      continue
    }

    if (attempt >= RETRIES) {
      throw new Error(
        `Another server (pid ${holder}) is already using ${dataDir}\n`
        + '  Two servers sharing one database corrupt the queue: each keeps its trivia\n'
        + '  rounds in memory, so one marks a round played that the other can never show.\n'
        + `  Stop pid ${holder}, or start this server with KES_PATH_DATA set elsewhere.`,
      )
    }

    await sleep(RETRY_MS)
  }
}

function isRunning (pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false

  try {
    process.kill(pid, 0) // signal 0 tests for the process without signalling it
    return true
  } catch (err) {
    // EPERM means it exists and belongs to another user — running, either way
    return err.code === 'EPERM'
  }
}
