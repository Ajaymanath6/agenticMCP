/**
 * Local Streamable HTTP MCP for smoke tests: http://127.0.0.1:3456/mcp
 * Run: npm run build && npm run vercel:prepare && npm run http:local
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { runMcpHttpRequest } from './mcp-http-handler.js'

const PORT = Number(process.env.MCP_HTTP_PORT ?? '3456')

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        if (!raw.trim()) {
          resolve(undefined)
          return
        }
        resolve(JSON.parse(raw) as unknown)
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  const url = req.url?.split('?')[0] ?? ''
  if (url !== '/mcp') {
    res.statusCode = 404
    res.end('Not found')
    return
  }

  let body: unknown
  if (req.method === 'POST') {
    try {
      body = await readJsonBody(req)
    } catch {
      res.statusCode = 400
      res.end('Invalid JSON')
      return
    }
  }

  await runMcpHttpRequest(
    req as IncomingMessage,
    res as ServerResponse,
    body,
  )
})

server.listen(PORT, '127.0.0.1', () => {
  console.error(`[agentic-catalog-http] http://127.0.0.1:${PORT}/mcp`)
})
