/**
 * Vite plugin for ACP integration in the design review viewer.
 *
 * Adds HTTP endpoints to the dev server:
 *  - POST /api/acp/tools — Execute design review tools (reads golden directory directly)
 *  - GET  /api/acp/state  — View current connected viewer state
 *
 * The plugin runs tools server-side by reading the golden directory, so
 * no WebSocket bridge is needed for tool execution.
 */
import type { Plugin } from 'vite';
import { executeTool, toolDefinitions } from './tools.js';

export function acpPlugin(): Plugin {
  return {
    name: 'acp-plugin',
    configureServer(server) {
      // List available tools
      server.middlewares.use('/api/acp/tools-list', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ tools: toolDefinitions }));
      });

      // Tool execution endpoint
      server.middlewares.use('/api/acp/tools', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: string) => { body += chunk; });
        req.on('end', async () => {
          try {
            const { tool, args } = JSON.parse(body) as { tool: string; args: Record<string, unknown> };
            const result = await executeTool(tool, args || {});
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (e) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      });

      console.error('[ACP] Tool endpoint: POST /api/acp/tools  {"tool":"designReview_listScreens","args":{}}');
      console.error('[ACP] Tools list:   GET  /api/acp/tools-list');
    },
  };
}
