import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { parseArgs } from 'node:util'

// Resolve package root by walking up to nearest package.json
function findProjectRoot (startDir: string) {
  let dir = startDir
  const root = path.parse(dir).root
  while (dir !== root) {
    const pkg = path.join(dir, 'package.json')
    if (fs.existsSync(pkg)) return dir
    dir = path.dirname(dir)
  }
  return startDir
}

const baseDir = findProjectRoot(path.dirname(fileURLToPath(import.meta.url)))

const env = {
  NODE_ENV: process.env.NODE_ENV,
  KES_CONSOLE_COLORS: process.env.KES_CONSOLE_COLORS
    ? !['0', 'false'].includes(process.env.KES_CONSOLE_COLORS?.toLowerCase())
    : undefined,
  KES_PATH_ASSETS: path.join(baseDir, 'assets'),
  // data dir keeps the pre-rebrand name so existing installs keep their database
  KES_PATH_DATA: process.env.KES_PATH_DATA || getAppPath('Karaoke Eternal Server'),
  KES_PATH_WEBROOT: path.join(baseDir, 'build', 'client'),
  KES_PORT: parseInt(process.env.KES_PORT, 10) || 0,
  KES_ROTATE_KEY: ['1', 'true'].includes(process.env.KES_ROTATE_KEY?.toLowerCase()),
  KES_SCAN: process.env.KES_SCAN?.trim(),
  KES_SCANNER_CONSOLE_LEVEL: parseLevel(process.env.KES_SCANNER_CONSOLE_LEVEL),
  KES_SCANNER_LOG_LEVEL: parseLevel(process.env.KES_SCANNER_LOG_LEVEL),
  KES_SERVER_CONSOLE_LEVEL: parseLevel(process.env.KES_SERVER_CONSOLE_LEVEL),
  KES_SERVER_LOG_LEVEL: parseLevel(process.env.KES_SERVER_LOG_LEVEL),
  KES_SERVER_URL: process.env.KES_SERVER_URL,
  KES_URL_PATH: process.env.KES_URL_PATH || '/',
  // support PUID/PGID convention
  KES_PUID: parseInt(process.env.PUID, 10) || undefined,
  KES_PGID: parseInt(process.env.PGID, 10) || undefined,
}

const HELP = `KaraokeArcade Server

  --data <path>              Absolute path of folder for database files
  -p, --port <n>             Web server port (default=0/auto)
  --rotateKey                Rotate the session key at startup
  --scan <ids>               Run the media scanner at startup. Accepts a
                             comma-separated list of pathIds, or "all"
  --scannerConsoleLevel <n>  Media scanner console output level (default=4)
  --scannerLogLevel <n>      Media scanner log file level (default=3)
  --serverConsoleLevel <n>   Web server console output level (default=4)
  --serverLogLevel <n>       Web server log file level (default=3)
  --serverUrl <url>          Absolute URL guests reach this server at, for join
                             QR codes and home screen installs. Defaults to the
                             current LAN IP, which changes with the network
  --urlPath <path>           Web server URL base path (default=/)
  -v, --version              Output the KaraokeArcade Server version and exit
  -h, --help                 Show this help and exit

  Logging options use the following numeric levels:
  0=off, 1=error, 2=warn, 3=info, 4=verbose, 5=debug`

// CLI options take precedence over env vars
const opts = {
  data: 'KES_PATH_DATA',
  port: 'KES_PORT',
  scan: 'KES_SCAN',
  scannerConsoleLevel: 'KES_SCANNER_CONSOLE_LEVEL',
  scannerLogLevel: 'KES_SCANNER_LOG_LEVEL',
  serverConsoleLevel: 'KES_SERVER_CONSOLE_LEVEL',
  serverLogLevel: 'KES_SERVER_LOG_LEVEL',
  serverUrl: 'KES_SERVER_URL',
  urlPath: 'KES_URL_PATH',
}

const numeric = new Set(['port', 'scannerConsoleLevel', 'scannerLogLevel', 'serverConsoleLevel', 'serverLogLevel'])

const { values: argv } = parseArgs({
  strict: false,
  options: {
    help: { type: 'boolean', short: 'h' },
    rotateKey: { type: 'boolean' },
    version: { type: 'boolean', short: 'v' },
    ...Object.fromEntries(Object.keys(opts).map(opt => [
      opt,
      { type: 'string' as const, ...(opt === 'port' ? { short: 'p' } : {}) },
    ])),
  },
})

if (argv.help) {
  console.log(HELP)
  process.exit(0) // eslint-disable-line n/no-process-exit
}

if (argv.version) {
  console.log(JSON.parse(fs.readFileSync(path.join(baseDir, 'package.json'), 'utf8')).version)
  process.exit(0) // eslint-disable-line n/no-process-exit
}

if (argv.rotateKey) {
  env.KES_ROTATE_KEY = true
}

for (const [opt, envVar] of Object.entries(opts)) {
  if (typeof argv[opt] === 'undefined') continue

  env[envVar] = numeric.has(opt) ? parseInt(argv[opt] as string, 10) : argv[opt]
  process.env[envVar] = String(argv[opt])
}

export default env

// 0 (off) is a valid level, so only NaN counts as unset
function parseLevel (val: string | undefined) {
  const n = parseInt(val, 10)
  return Number.isNaN(n) ? undefined : n
}

function getAppPath (appName: string) {
  const home = os.homedir()

  switch (process.platform) {
    case 'darwin': {
      return path.join(home, 'Library', 'Application Support', appName)
    }

    case 'win32': {
      return withLegacy(process.env.APPDATA, path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), appName))
    }

    default: {
      return withLegacy(process.env.XDG_CONFIG_HOME, path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), appName))
    }
  }
}

// older builds put the database directly in APPDATA/XDG_CONFIG_HOME without the
// app folder; keep using it there until the user moves it
function withLegacy (legacyDir: string | undefined, dir: string) {
  if (legacyDir
    && !fs.existsSync(path.join(dir, 'database.sqlite3'))
    && fs.existsSync(path.join(legacyDir, 'database.sqlite3'))) {
    return legacyDir
  }

  return dir
}
