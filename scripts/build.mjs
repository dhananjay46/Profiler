// Builds the plugin into dist/:
//   dist/code.js  – main code (Figma sandbox)
//   dist/ui.html  – the panel, with its bundled script inlined (Figma requires a
//                   single self-contained HTML file; no network access is used)
//
// Usage: node scripts/build.mjs [--watch]

import * as esbuild from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const watch = process.argv.includes('--watch')
const MARKER = '<!-- UI_SCRIPT -->'

/** After each UI build, inline the bundle into the HTML template. */
const inlineIntoHtml = {
  name: 'inline-into-html',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) return
      const js = result.outputFiles.find((file) => file.path.endsWith('.js')).text
      const template = await readFile('src/ui/ui.html', 'utf8')
      if (!template.includes(MARKER)) throw new Error(`src/ui/ui.html is missing ${MARKER}`)
      // "</script" inside the bundle would end the inline script early.
      const safe = js.replace(/<\/script/gi, '<\\/script')
      // Use a function so "$&"-style sequences in the bundle are not treated as patterns.
      const html = template.replace(MARKER, () => `<script type="module">\n${safe}\n</script>`)
      await mkdir('dist', { recursive: true })
      await writeFile('dist/ui.html', html)
      console.log(`  dist/ui.html  ${(html.length / 1024).toFixed(0)}kb`)
    })
  },
}

const mainOptions = {
  entryPoints: ['src/main/code.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2017',
  outfile: 'dist/code.js',
  logLevel: 'info',
}

const uiOptions = {
  entryPoints: ['src/ui/main.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  outfile: 'dist/ui.js',
  write: false,
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
  plugins: [inlineIntoHtml],
}

if (watch) {
  const contexts = await Promise.all([esbuild.context(mainOptions), esbuild.context(uiOptions)])
  await Promise.all(contexts.map((ctx) => ctx.watch()))
  console.log('Watching for changes…')
} else {
  await Promise.all([esbuild.build(mainOptions), esbuild.build(uiOptions)])
}
