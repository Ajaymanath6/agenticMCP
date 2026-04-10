import fs from 'node:fs'
import path from 'node:path'
import { getBlueprintsDir } from './paths.js'

export type CatalogComponentKind = 'component' | 'layout'

export type CatalogComponentEntry = {
  id: string
  publishedAt: string
  hasBlueprint: boolean
  apiEndpoint: string | null
  importId: string
  thumbnailPath: string
  blueprintPath: string
  kind?: CatalogComponentKind
}

export type CatalogIndexFile = {
  version: string
  lastUpdated: string
  components: CatalogComponentEntry[]
}

export function readCatalogIndex(): CatalogIndexFile {
  const dir = getBlueprintsDir()
  const p = path.join(dir, '_catalog.json')
  if (!fs.existsSync(p)) {
    throw new Error(`Catalog index not found: ${p}`)
  }
  const raw = fs.readFileSync(p, 'utf8')
  return JSON.parse(raw) as CatalogIndexFile
}

function resolvedBlueprintsRoot(): string {
  return path.resolve(getBlueprintsDir())
}

/**
 * Ensure `absolutePath` is inside the blueprints directory (no traversal).
 */
export function assertPathInsideBlueprints(absolutePath: string): void {
  const root = resolvedBlueprintsRoot()
  const resolved = path.resolve(absolutePath)
  const prefix = root.endsWith(path.sep) ? root : root + path.sep
  if (resolved !== root && !resolved.startsWith(prefix)) {
    throw new Error('Resolved path escapes public/blueprints')
  }
}

/**
 * Resolve a blueprint file under `public/blueprints`.
 * - `blueprintFile`: basename only, must end with `.json` (e.g. `canvas-primary-….json`).
 * - `blueprintPath`: catalog field like `/blueprints/foo.json`.
 */
export function resolveBlueprintAbsolute(options: {
  blueprintPath?: string
  blueprintFile?: string
}): string {
  const dir = getBlueprintsDir()

  if (options.blueprintFile) {
    const base = path.basename(options.blueprintFile)
    if (base !== options.blueprintFile || base.includes('..')) {
      throw new Error('blueprintFile must be a plain filename, no paths')
    }
    if (!base.endsWith('.json')) {
      throw new Error('blueprintFile must be a .json file')
    }
    if (base === '_catalog.json') {
      throw new Error('Use list_catalog for the index; blueprintFile is for component blueprints only')
    }
    const abs = path.resolve(dir, base)
    assertPathInsideBlueprints(abs)
    return abs
  }

  if (options.blueprintPath) {
    const normalized = options.blueprintPath.trim().replace(/^\/+/, '')
    if (!normalized.startsWith('blueprints/')) {
      throw new Error(
        `blueprintPath must start with /blueprints/ (got: ${options.blueprintPath})`,
      )
    }
    const rel = normalized.slice('blueprints/'.length)
    if (rel.includes('..') || path.isAbsolute(rel)) {
      throw new Error('Invalid blueprintPath')
    }
    const abs = path.resolve(dir, rel)
    assertPathInsideBlueprints(abs)
    return abs
  }

  throw new Error('Provide blueprintPath or blueprintFile')
}

export function readBlueprintJson(absolutePath: string): unknown {
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Blueprint file not found: ${absolutePath}`)
  }
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown
}

export function findEntryById(
  index: CatalogIndexFile,
  id: string,
): CatalogComponentEntry | undefined {
  return index.components.find((c) => c.id === id)
}

export function listCatalogRows(
  index: CatalogIndexFile,
  kind?: CatalogComponentKind,
): Pick<
  CatalogComponentEntry,
  | 'id'
  | 'kind'
  | 'importId'
  | 'blueprintPath'
  | 'publishedAt'
  | 'hasBlueprint'
>[] {
  let rows = index.components
  if (kind) {
    rows = rows.filter((c) => (c.kind ?? 'component') === kind)
  }
  return rows.map((c) => ({
    id: c.id,
    kind: c.kind ?? 'component',
    importId: c.importId,
    blueprintPath: c.blueprintPath,
    publishedAt: c.publishedAt,
    hasBlueprint: c.hasBlueprint,
  }))
}

export function searchCatalogRows(
  index: CatalogIndexFile,
  query: string,
): ReturnType<typeof listCatalogRows> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return index.components
    .filter((c) => {
      const hay = `${c.id} ${c.importId} ${c.blueprintPath}`.toLowerCase()
      return hay.includes(q)
    })
    .map((c) => ({
      id: c.id,
      kind: c.kind ?? 'component',
      importId: c.importId,
      blueprintPath: c.blueprintPath,
      publishedAt: c.publishedAt,
      hasBlueprint: c.hasBlueprint,
    }))
}
