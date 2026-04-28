/**
 * Vite plugin for ACP integration in the design review viewer.
 *
 * HTTP endpoints:
 *  - POST /api/acp/chat      — Chat via local Claude Code (claude -p)
 *  - POST /api/acp/tools     — Execute design review tools server-side
 *  - GET  /api/acp/tools-list — List available tools
 */
import type { Plugin } from 'vite';
import { spawn } from 'node:child_process';
import { executeTool, toolDefinitions } from './tools.js';

/** Find claude binary on PATH */
function findClaude(): string {
  const candidates = ['claude', '~/.local/bin/claude'];
  const envPath = process.env.PATH || '';
  for (const c of candidates) {
    const resolved = c.startsWith('~') ? c.replace(/^~/, process.env.HOME || '') : c;
    if (resolved.includes('/')) {
      try { require('node:fs').accessSync(resolved); return resolved; } catch { continue; }
    }
    for (const dir of envPath.split(':')) {
      const p = `${dir}/${resolved}`;
      try { require('node:fs').accessSync(p); return resolved; } catch { continue; }
    }
  }
  return 'claude'; // fallback
}

const CLAUDE_BIN = findClaude();

async function chatWithClaude(
  message: string,
  onChunk: (chunk: string) => void,
  signal: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    const claude = spawn(CLAUDE_BIN, ['-p', message, '--permission-mode', 'auto', '--no-session-persistence'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    });

    signal.addEventListener('abort', () => {
      claude.kill();
      reject(new Error('aborted'));
    });

    let output = '';
    claude.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      onChunk(text);
    });

    let stderr = '';
    claude.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    claude.on('close', (code) => {
      if (code === 0 || code === null) resolve(output);
      else reject(new Error(stderr || `claude exited ${code}`));
    });

    claude.on('error', (e) => reject(e));
  });
}

export function acpPlugin(): Plugin {
  return {
    name: 'acp-plugin',
    configureServer(server) {
      // ── Chat via local Claude Code ──
      server.middlewares.use('/api/acp/chat', (req, res) => {
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
            const { message, context } = JSON.parse(body) as { message: string; context?: Record<string, unknown> };

            const contextHint = context
              ? `Current screen: ${context.currentScreen || 'none'}\n`
              : '';
            const prompt = `${contextHint}Design review viewer query: ${message}\n\nAnswer concisely.`;

            const ac = new AbortController();
            req.on('close', () => ac.abort());

            const response = await chatWithClaude(prompt, () => {}, ac.signal);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ response: response.trim() }));
          } catch (e: any) {
            if (e.message === 'aborted') return;
            // Fallback: use local tools
            try {
              const { message } = JSON.parse(body);
              const result = await executeTool(
                message.toLowerCase().includes('screen') && !message.toLowerCase().includes('metadata')
                  ? 'designReview_listScreens'
                  : 'designReview_listScreens',
                {}
              );
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                response: `(local mode) ${result.content[0].text}`,
                note: 'Claude not available, used local tool fallback',
              }));
            } catch {
              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Claude not available', detail: String(e) }));
            }
          }
        });
      });

      // ── Tools list ──
      server.middlewares.use('/api/acp/tools-list', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ tools: toolDefinitions }));
      });

      // ── Tool execution ──
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

      console.error(`[ACP] Claude binary: ${CLAUDE_BIN}`);
      console.error('[ACP] Chat endpoint:  POST /api/acp/chat  {"message":"list screens"}');
      console.error('[ACP] Tool endpoint:  POST /api/acp/tools  {"tool":"designReview_listScreens","args":{}}');
      console.error('[ACP] Tools list:     GET  /api/acp/tools-list');
    },
  };
}
