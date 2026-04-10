import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Agentic monorepo root: env `AGENTIC_ROOT`, else walk up from this file until
 * `public/blueprints/_catalog.json` exists (`dist/src/index.js` needs 3 hops; legacy `dist/index.js` used 2).
 */
export function getAgenticRoot(): string {
  const fromEnv = process.env.AGENTIC_ROOT?.trim()
  if (fromEnv) {
    return path.resolve(fromEnv)
  }
  const here = path.dirname(fileURLToPath(import.meta.url))
  for (let depth = 1; depth <= 8; depth++) {
    const candidate = path.resolve(here, ...Array(depth).fill('..'))
    const marker = path.join(
      candidate,
      'public',
      'blueprints',
      '_catalog.json',
    )
    if (fs.existsSync(marker)) {
      return candidate
    }
  }
  return path.resolve(here, '..', '..', '..')
}

/**
 * When set, blueprints are read from this directory directly (`_catalog.json` + `*.json`).
 * Otherwise: `AGENTIC_ROOT/public/blueprints` (default Agentic layout).
 */
export function getBlueprintsDir(): string {
  const override = process.env.AGENTIC_BLUEPRINTS_DIR?.trim()
  if (override) {
    return path.resolve(override)
  }
  return path.join(getAgenticRoot(), 'public', 'blueprints')
}

/**
 * For Streamable HTTP (Vercel / local `http:local`): if `AGENTIC_BLUEPRINTS_DIR` is unset,
 * set it to the first directory that actually contains `_catalog.json` among common layouts
 * (`catalog-data/`, `public/blueprints/` under cwd and ancestors of this module).
 *
 * Previously the HTTP layer always forced `cwd/catalog-data`, which breaks when that folder
 * is missing from the bundle but the catalog lives elsewhere (or cwd differs from the bundle root).
 */
export function resolveServerlessBlueprintsEnv(): void {
  const existing = process.env.AGENTIC_BLUEPRINTS_DIR?.trim()
  if (existing) {
    const resolved = path.resolve(existing)
    if (fs.existsSync(path.join(resolved, '_catalog.json'))) {
      return
    }
    // e.g. Vercel env `catalog-data` → /var/task/catalog-data while bundle uses
    // mcp-server/catalog-data — drop bad override and discover below.
    delete process.env.AGENTIC_BLUEPRINTS_DIR
  }

  const here = path.dirname(fileURLToPath(import.meta.url))
  const cwd = process.cwd()
  const candidates: string[] = []
  const seen = new Set<string>()
  const push = (p: string) => {
    const resolved = path.resolve(p)
    if (!seen.has(resolved)) {
      seen.add(resolved)
      candidates.push(resolved)
    }
  }

  // Repo-root Vercel deploy: includeFiles bundles `mcp-server/catalog-data/**`
  // under `/var/task/mcp-server/catalog-data`, not `/var/task/catalog-data`.
  push(path.join(cwd, 'mcp-server', 'catalog-data'))
  push(path.join(cwd, 'catalog-data'))
  push(path.join(cwd, 'public', 'blueprints'))

  for (let depth = 0; depth <= 6; depth++) {
    const base = path.resolve(here, ...Array(depth).fill('..'))
    push(path.join(base, 'mcp-server', 'catalog-data'))
    push(path.join(base, 'catalog-data'))
    push(path.join(base, 'public', 'blueprints'))
  }

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, '_catalog.json'))) {
      process.env.AGENTIC_BLUEPRINTS_DIR = dir
      return
    }
  }
}
