import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  findEntryById,
  listCatalogRows,
  readBlueprintJson,
  readCatalogIndex,
  resolveBlueprintAbsolute,
  searchCatalogRows,
} from './catalog-fs.js'

const blueprintInputSchema = {
  id: z
    .string()
    .optional()
    .describe(
      'Catalog id from list_catalog (e.g. canvas-primary-812edd61-9aad-4a9a-afba-9bd0bc393e82)',
    ),
  blueprintFile: z
    .string()
    .optional()
    .describe(
      'Filename only inside public/blueprints (e.g. canvas-primary-….json), not a path',
    ),
}

const blueprintSelectorSchema = z
  .object(blueprintInputSchema)
  .refine(
    (o) => (o.id ? 1 : 0) + (o.blueprintFile ? 1 : 0) === 1,
    { message: 'Provide exactly one of id or blueprintFile' },
  )

function parseBlueprintSelector(
  args: unknown,
): z.infer<typeof blueprintSelectorSchema> {
  const parsed = blueprintSelectorSchema.safeParse(args)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ')
    throw new Error(msg)
  }
  return parsed.data
}

function resolveBlueprintPathFromArgs(args: {
  id?: string
  blueprintFile?: string
}): string {
  if (args.id) {
    const index = readCatalogIndex()
    const entry = findEntryById(index, args.id)
    if (!entry) {
      throw new Error(`No catalog entry for id: ${args.id}`)
    }
    if (!entry.hasBlueprint || !entry.blueprintPath) {
      throw new Error(`Entry ${args.id} has no blueprint path`)
    }
    return resolveBlueprintAbsolute({ blueprintPath: entry.blueprintPath })
  }
  return resolveBlueprintAbsolute({ blueprintFile: args.blueprintFile })
}

function toolError(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  }
}

/** Register catalog MCP tools on the given server (stdio or HTTP). */
export function registerCatalogTools(server: McpServer): void {
  server.registerTool(
    'list_catalog',
    {
      description:
        'List published catalog entries from public/blueprints/_catalog.json (ids, blueprint paths, kinds). Use before get_blueprint to pick an id.',
      inputSchema: {
        kind: z
          .enum(['component', 'layout'])
          .optional()
          .describe('Filter by kind; omit to return all entries'),
      },
      annotations: {
        title: 'List catalog',
        readOnlyHint: true,
      },
    },
    async ({ kind }) => {
      try {
        const index = readCatalogIndex()
        const rows = listCatalogRows(index, kind)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  lastUpdated: index.lastUpdated,
                  count: rows.length,
                  components: rows,
                },
                null,
                2,
              ),
            },
          ],
        }
      } catch (e) {
        return toolError(e instanceof Error ? e.message : String(e))
      }
    },
  )

  server.registerTool(
    'search_catalog',
    {
      description:
        'Search catalog index by substring match on id, importId, or blueprintPath (case-insensitive).',
      inputSchema: {
        query: z.string().min(1).describe('Substring to search for'),
      },
      annotations: {
        title: 'Search catalog',
        readOnlyHint: true,
      },
    },
    async ({ query }) => {
      try {
        const index = readCatalogIndex()
        const rows = searchCatalogRows(index, query)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { count: rows.length, components: rows },
                null,
                2,
              ),
            },
          ],
        }
      } catch (e) {
        return toolError(e instanceof Error ? e.message : String(e))
      }
    },
  )

  server.registerTool(
    'get_blueprint',
    {
      description:
        'Load one blueprint JSON by catalog id (preferred) or by blueprint filename. Returns full document (can be large if sourceHtml is present); prefer get_source_html for HTML only.',
      inputSchema: blueprintInputSchema,
      annotations: {
        title: 'Get blueprint JSON',
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const sel = parseBlueprintSelector(args)
        const abs = resolveBlueprintPathFromArgs(sel)
        const data = readBlueprintJson(abs)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        }
      } catch (e) {
        return toolError(e instanceof Error ? e.message : String(e))
      }
    },
  )

  server.registerTool(
    'get_source_html',
    {
      description:
        'Return only blueprint.data.sourceHtml for a component (smaller than get_blueprint). Same inputs as get_blueprint.',
      inputSchema: blueprintInputSchema,
      annotations: {
        title: 'Get sourceHtml',
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const sel = parseBlueprintSelector(args)
        const abs = resolveBlueprintPathFromArgs(sel)
        const data = readBlueprintJson(abs) as {
          data?: { sourceHtml?: string }
        }
        const html = data?.data?.sourceHtml
        if (typeof html !== 'string' || html.length === 0) {
          return toolError('No data.sourceHtml string in this blueprint')
        }
        return {
          content: [{ type: 'text', text: html }],
        }
      } catch (e) {
        return toolError(e instanceof Error ? e.message : String(e))
      }
    },
  )
}
