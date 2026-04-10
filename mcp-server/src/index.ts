import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerCatalogTools } from './register-catalog-tools.js'
import { getAgenticRoot, getBlueprintsDir } from './paths.js'

const server = new McpServer(
  {
    name: 'agentic-catalog',
    version: '1.0.0',
  },
  {
    capabilities: {},
  },
)

registerCatalogTools(server)

async function main() {
  const root = getAgenticRoot()
  const bp = getBlueprintsDir()
  console.error(`[agentic-catalog] AGENTIC_ROOT=${root}`)
  console.error(
    `[agentic-catalog] blueprints=${bp}${process.env.AGENTIC_BLUEPRINTS_DIR?.trim() ? ' (AGENTIC_BLUEPRINTS_DIR)' : ''}`,
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
