// Bundles tests/*.test.ts with esbuild and runs them with Node's built-in test runner.
// Usage: node scripts/test.mjs

import * as esbuild from 'esbuild'
import { spawnSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'

const OUT = '.test-out'
const tests = readdirSync('tests').filter((name) => name.endsWith('.test.ts'))

rmSync(OUT, { recursive: true, force: true })
await esbuild.build({
  entryPoints: tests.map((name) => `tests/${name}`),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external', // resolve pdfjs-dist, fflate from node_modules at run time
  outdir: OUT,
  outExtension: { '.js': '.mjs' },
  sourcemap: 'inline',
  logLevel: 'warning',
})

const files = tests.map((name) => `${OUT}/${name.replace(/\.ts$/, '.mjs')}`)
const result = spawnSync(process.execPath, ['--enable-source-maps', '--test', ...files], { stdio: 'inherit' })
process.exit(result.status ?? 1)
