import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runMcpHttpRequest } from '../src/mcp-http-handler.js'

/**
 * Vercel serverless: Streamable HTTP MCP (stateless).
 * URL: /api/mcp (or /mcp via rewrite in vercel.json).
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const parsedBody =
    req.method === 'POST' &&
    req.body !== undefined &&
    req.body !== null &&
    typeof req.body === 'object'
      ? req.body
      : undefined

  await runMcpHttpRequest(req, res, parsedBody)
}
