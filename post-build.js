// post-build.js — Organizes Vite build output for GitHub Pages deployment
// Target structure:
//   addin/index.html    addin/dialog.html    addin/manifest.xml    addin/assets/icon.png
//   assets/*.js         assets/*.css
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, renameSync, rmSync } from 'fs'
import { join, dirname } from 'path'

const dist = 'dist'
const addinDir = 'addin'
const assetsDir = 'assets'

// Clean target dirs
rmSync(addinDir, { recursive: true, force: true })
rmSync(assetsDir, { recursive: true, force: true })
mkdirSync(join(addinDir, 'assets'), { recursive: true })
mkdirSync(assetsDir, { recursive: true })

// Move HTML entry files (Vite preserves input structure, so they're in dist/dev/)
const devDist = join(dist, 'dev')
if (existsSync(join(devDist, 'index.html'))) {
  copyFileSync(join(devDist, 'index.html'), join(addinDir, 'index.html'))
}
if (existsSync(join(devDist, 'dialog.html'))) {
  copyFileSync(join(devDist, 'dialog.html'), join(addinDir, 'dialog.html'))
}

// Move JS/CSS assets
if (existsSync(join(dist, 'assets'))) {
  const files = readdirSync(join(dist, 'assets'))
  for (const f of files) {
    // Add-in specific assets go to assets/ dir
    const src = join(dist, 'assets', f)
    const dst = join(assetsDir, f)
    copyFileSync(src, dst)
  }
}

// Fix underscore-prefixed files (GitHub Pages Jekyll ignores them)
const allDirs = [addinDir, assetsDir]
for (const dir of allDirs) {
  if (!existsSync(dir)) continue
  const entries = readdirSync(dir)
  for (const entry of entries) {
    if (!entry.startsWith('_')) continue
    const oldPath = join(dir, entry)
    const newPath = join(dir, 'x-' + entry.slice(1))
    renameSync(oldPath, newPath)
    console.log(`Renamed: ${entry} → x-${entry.slice(1)}`)
  }
}

// Fix references inside all JS/HTML/CSS files
import { execSync } from 'child_process'
const fixUnderscore = `find ${addinDir} ${assetsDir} -type f \\( -name "*.html" -o -name "*.js" -o -name "*.css" \\) -exec sed -i '' 's/_plugin-vue_export-helper/x-plugin-vue_export-helper/g' {} +`
try { execSync(fixUnderscore) } catch {}

// Fix HTML paths: ./assets/ in addin/ HTMLs → ../assets/ (root-level assets dir)
for (const f of ['index.html', 'dialog.html']) {
  const fp = join(addinDir, f)
  if (existsSync(fp)) {
    let html = readFileSync(fp, 'utf-8')
    html = html.replace(/\.\/assets\//g, '../assets/')
    writeFileSync(fp, html)
  }
}

// Copy static assets (icon, manifest)
if (existsSync('public/addin/assets/icon.png')) {
  copyFileSync('public/addin/assets/icon.png', join(addinDir, 'assets', 'icon.png'))
}
if (existsSync('public/addin/manifest.xml')) {
  copyFileSync('public/addin/manifest.xml', join(addinDir, 'manifest.xml'))
}

console.log('Post-build done!')
