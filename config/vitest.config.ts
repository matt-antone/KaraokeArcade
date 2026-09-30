import { defineConfig, configDefaults } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    // webpack treats every .css here as a CSS module; vite only treats
    // *.module.css that way, so under vitest `styles.foo` would be undefined and
    // no test could tell one class from another. Hand back the key instead.
    {
      name: 'css-module-identity',
      enforce: 'pre',
      // the virtual id must not itself end in .css, or vite's own CSS plugin
      // claims it back and transforms the module we just returned
      resolveId: (id: string, importer?: string) => (id.endsWith('.css') && importer
        ? { id: `\0css-identity:${id.slice(0, -4)}` }
        : null),
      load: (id: string) => (id.startsWith('\0css-identity:')
        ? 'export default new Proxy({}, { get: (_, key) => (typeof key === "string" ? key : undefined) })'
        : null),
    },
  ],
  // webpack's DefinePlugin constants; tests play songs in full
  define: { __DEV_SONG_SECONDS__: 0 },
  // mirrors webpack's resolve.modules/alias so client code is importable in tests
  resolve: {
    alias: ['components', 'lib', 'routes', 'store', 'styles', 'types'].reduce(
      (alias, dir) => ({ ...alias, [dir]: path.resolve(__dirname, '../src', dir) }),
      { shared: path.resolve(__dirname, '../shared') },
    ),
  },
  test: {
    // build/ holds compiled copies of the server tests; running them twice just
    // reports the setup file's logger init against the wrong module instance
    // .claude/worktrees holds full checkouts of this same repo; without this,
    // a run from the repo root collects every worktree's copy of every test
    exclude: [...configDefaults.exclude, 'build/**', '.claude/**'],
    setupFiles: [path.resolve(__dirname, '../server/lib/test-setup.ts')],
  },
})
