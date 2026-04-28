/**
 * Vite plugin — ACP chat + tools.
 *
 * Endpoints:
 *  POST /api/acp/chat       — Chat: local tools (instant) + Claude Code (AI, streaming)
 *  POST /api/acp/tools      — Execute tool by name
 *  GET  /api/acp/tools-list  — List tools
 *
 * AI queries stream via ndjson (newline-delimited JSON):
 *   {"type":"chunk","text":"..."}   — partial text delta
 *   {"type":"done","text":"..."}    — full accumulated response
 *   {"type":"error","text":"..."}   — error message
 */
import type { Plugin } from 'vite';
import { spawn, execSync } from 'node:child_process';
import { executeTool, listScreens, getScreenMeta, getScreenPath, toolDefinitions } from './tools.js';

function findClaudeBinary(): string {
  if (process.env.CLAUDE_BIN_PATH) return process.env.CLAUDE_BIN_PATH;
  try {
    return execSync('which claude', { encoding: 'utf-8' }).trim();
  } catch {
    return 'claude';
  }
}

function formatScreens(json: Record<string, unknown>): string {
  const screens = json.screens as string[] | undefined;
  if (!screens || screens.length === 0) return 'Tidak ada screen ditemukan.';
  return screens.map((s, i) => `${i + 1}. ${s.replace(/_/g, ' ')}`).join('\n');
}

function formatMeta(json: Record<string, unknown>): string {
  const meta = json.metadata as Record<string, unknown> | undefined;
  if (!meta) return 'Screen tidak ditemukan.';
  const desc = meta.description || '-';
  const purpose = meta.purpose || '-';
  const states = (meta.states as string[]) || [];
  const elements = (meta.keyElements as string[]) || [];
  return `Deskripsi: ${desc}\nTujuan: ${purpose}\nState: ${states.join(', ') || '-'}\nKey Elements: ${elements.join(', ') || '-'}`;
}

function isToolQuery(q: string): { isTool: boolean; tool?: string; args?: Record<string, unknown> } {
  const lq = q.toLowerCase().trim();

  // "list screens" or "list" alone
  if (/^list|^(show|tampilkan|lihat)\s/.test(lq) || lq === 'screens' || lq === 'screen') {
    return { isTool: true, tool: 'designReview_listScreens', args: {} };
  }
  // "detail <name>" or "metadata <name>"
  const detailMatch = lq.match(/^(detail|metadata|about)\s+(.+)/);
  if (detailMatch) {
    const name = detailMatch[2].trim().replace(/\s+/g, '_');
    if (name) return { isTool: true, tool: 'designReview_getScreenMeta', args: { screen: name } };
  }
  return { isTool: false };
}

/**
 * Parse Claude's stream-json output and forward text_delta chunks.
 * Calls onChunk for each text delta, onDone with full text at end.
 */
function streamClaudeResponse(
  claudeBin: string,
  prompt: string,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (msg: string) => void,
): { kill: () => void } {
  const claude = spawn(
    claudeBin,
    [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--bare',
      '--tools', '',
      '--permission-mode', 'auto',
      '--no-session-persistence',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } },
  );

  let fullText = '';
  let buffer = '';
  let didRespond = false;
  const timeoutId = setTimeout(() => { if (!claude.killed) claude.kill('SIGKILL'); }, 120000);

  function respond() {
    if (didRespond) return;
    didRespond = true;
    clearTimeout(timeoutId);
    onDone(fullText);
  }

  claude.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (
          parsed.type === 'stream_event' &&
          parsed.event?.type === 'content_block_delta' &&
          parsed.event.delta?.type === 'text_delta'
        ) {
          const text = parsed.event.delta.text as string;
          fullText += text;
          onChunk(text);
        }
      } catch {
        // skip malformed JSON lines
      }
    }
  });

  claude.stderr.on('data', () => {});

  claude.on('close', (code, _signal) => {
    clearTimeout(timeoutId);
    if (code !== 0 && !fullText) {
      onError(`Claude exited with code ${code}`);
      return;
    }
    respond();
  });

  claude.on('error', (e) => {
    clearTimeout(timeoutId);
    onError(`Claude spawn error: ${e.message}`);
  });

  return { kill: () => { if (!claude.killed) claude.kill(); } };
}

export function acpPlugin(): Plugin {
  return {
    name: 'acp-plugin',
    configureServer(server) {
      // ── Chat ──
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
            const q = message.toLowerCase();

            // Tool queries — instant (no streaming)
            const toolMatch = isToolQuery(q);
            if (toolMatch.isTool && toolMatch.tool) {
              if (toolMatch.tool === 'designReview_listScreens') {
                const result = listScreens() as Record<string, unknown>;
                const formatted = formatScreens(result);
                const total = (result.screens as string[] || []).length;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ response: `Ada ${total} screen:\n${formatted}\n\nTanya "detail [nama]" buat info screen.` }));
              } else {
                const meta = getScreenMeta(String(toolMatch.args?.screen || '')) as Record<string, unknown>;
                if (meta.error) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ response: `Screen tidak ditemukan.` }));
                } else {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ response: formatMeta(meta) }));
                }
              }
              return;
            }

            // AI queries — streaming via ndjson
            const screens = listScreens();
            const screenNames = ((screens as Record<string, unknown>).screens as string[] || []).join(', ');

            // Build file path context
            const currentScreen = context?.currentScreen as string | undefined;
            const queryParam = context?.queryParam as string | undefined;
            let filePrompt = '';
            if (currentScreen) {
              const specPath = getScreenPath(currentScreen);
              filePrompt = `\n\n## File Location\nSpec file: ${specPath}`;
              if (queryParam) filePrompt += `\nURL query: ${queryParam}`;
            }

            // Build marker context section
            const markerContext = context?.markerContext as Record<string, unknown> | undefined;
            let markerPrompt = '';
            if (markerContext) {
              const rect = markerContext.rect as Record<string, number> | undefined;
              const el = markerContext.element as Record<string, string> | undefined;
              const screen = markerContext.screen as string;
              const state = markerContext.state as string;
              markerPrompt = `\n\n## Marked Area Context\nUser marked area at [x:${rect?.x ?? '?'}, y:${rect?.y ?? '?'}, w:${rect?.width ?? '?'}, h:${rect?.height ?? '?'}] on screen "${screen}" (state: ${state}).`;
              if (el) {
                markerPrompt += `\nThe marked element is <${el.tag}> with selector "${el.selector || ''}" and text: "${el.text || ''}".`;
              }
              markerPrompt += '\nFocus answer on the marked area specifically.';
            }

            const prompt = `Kamu asisten design review MoneyKitty. Screen yang tersedia: ${screenNames || '(none)'}${filePrompt}${markerPrompt}\n\nPertanyaan: ${message}\n\nJawab singkat dan informatif.`;

            res.writeHead(200, {
              'Content-Type': 'application/x-ndjson',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            });

            const claudeBin = findClaudeBinary();
            const controller = streamClaudeResponse(
              claudeBin,
              prompt,
              // onChunk — stream partial text
              (text) => {
                if (!res.destroyed && !res.writableEnded) res.write(JSON.stringify({ type: 'chunk', text }) + '\n');
              },
              // onDone — send full text
              (fullText) => {
                if (!res.destroyed && !res.writableEnded) {
                  res.write(JSON.stringify({ type: 'done', text: fullText }) + '\n');
                  res.end();
                }
              },
              // onError
              (msg) => {
                if (!res.destroyed && !res.writableEnded) {
                  res.write(JSON.stringify({ type: 'error', text: msg }) + '\n');
                  res.end();
                }
              },
            );

            req.on('close', () => {});
          } catch (e) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ response: 'Gagal.', error: String(e) }));
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
    },
  };
}
