import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const outDir = resolve(rootDir, 'dist')
const publicDir = resolve(rootDir, 'public')

const entries = [
  { name: 'popup', entry: resolve(rootDir, 'src/popup/main.tsx') },
  { name: 'content', entry: resolve(rootDir, 'src/content/index.tsx') },
  { name: 'background', entry: resolve(rootDir, 'src/background/index.ts') },
]

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
await cp(publicDir, outDir, { recursive: true })

await Promise.all(
  entries.map(({ name, entry }) =>
    build({
      entryPoints: [entry],
      outfile: resolve(outDir, `${name}.js`),
      bundle: true,
      format: 'iife',
      target: ['chrome120'],
      platform: 'browser',
      jsx: 'automatic',
      loader: {
        '.css': 'text'
      },
      define: {
        'process.env.NODE_ENV': '"production"',
      },
    }),
  ),
)

