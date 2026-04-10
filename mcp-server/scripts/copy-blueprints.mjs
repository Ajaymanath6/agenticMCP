#!/usr/bin/env node
/**
 * Copy Agentic catalog into mcp-server/catalog-data for Vercel bundles.
 * Run from mcp-server root after `npm run build`. Repo layout: ../public/blueprints
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mcpRoot = path.resolve(__dirname, '..')
const srcBlueprints = path.resolve(mcpRoot, '..', 'public', 'blueprints')
const dest = path.resolve(mcpRoot, 'catalog-data')

if (!fs.existsSync(srcBlueprints)) {
  console.warn(
    '[copy-blueprints] Source missing (ok for CI without full repo):',
    srcBlueprints,
  )
  fs.mkdirSync(dest, { recursive: true })
  fs.writeFileSync(
    path.join(dest, '_catalog.json'),
    JSON.stringify(
      { version: '1.0', lastUpdated: new Date().toISOString(), components: [] },
      null,
      2,
    ),
  )
  process.exit(0)
}

fs.mkdirSync(dest, { recursive: true })
fs.cpSync(srcBlueprints, dest, { recursive: true })
console.log('[copy-blueprints] Copied', srcBlueprints, '->', dest)
