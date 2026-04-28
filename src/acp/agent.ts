/**
 * Standalone ACP Agent for Design Review Viewer.
 *
 * Implements full Agent interface over stdio. Spawn this from any
 * ACP-compatible client (Zed, Claude Code) to query design review data.
 *
 * Usage:
 *   npx tsx src/acp/agent.ts
 *
 * For manual testing with the SDK example client:
 *   npx tsx src/acp/agent.ts | npx tsx node_modules/@agentclientprotocol/sdk/src/examples/client.ts
 */
import {
  AgentSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
} from '@agentclientprotocol/sdk';
import type { Agent } from '@agentclientprotocol/sdk';
import type {
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  CancelNotification,
  AuthenticateRequest,
  AuthenticateResponse,
  SessionNotification,
} from '@agentclientprotocol/sdk';
import { listScreens, getScreenMeta, toolDefinitions } from './tools.js';
import { spawn } from 'node:child_process';

class DesignReviewAgent implements Agent {
  private conn: AgentSideConnection;
  private activeClaude: { process: ReturnType<typeof spawn>; killed: boolean } | null = null;

  constructor(conn: AgentSideConnection) {
    this.conn = conn;
  }

  async initialize(_params: InitializeRequest): Promise<InitializeResponse> {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: { loadSession: false },
      agentInfo: { name: 'moneykitty-acp-agent', version: '1.0.0' },
      authMethods: [],
    };
  }

  async newSession(_params: NewSessionRequest): Promise<NewSessionResponse> {
    return { sessionId: crypto.randomUUID() };
  }

  async authenticate(_params: AuthenticateRequest): Promise<AuthenticateResponse> {
    return {};
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    const sessionId = params.sessionId;
    const userText = params.prompt.find((b) => b.type === 'text')?.text || '';
    const q = userText.toLowerCase().trim();

    // ── Tool queries (instant) ──
    if (q.startsWith('list')) {
      const result = listScreens() as Record<string, unknown>;
      const screens = (result.screens as string[]) || [];
      const names = screens.map((s: string, i: number) => `${i + 1}. ${s.replace(/_/g, ' ')}`).join('\n');
      const text = `Ada ${screens.length} screen:\n${names}\n\nTanya "detail [nama]" buat info screen.`;
      await this.conn.sessionUpdate({
        sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } },
      });
      return { stopReason: 'end_turn' };
    }

    const detailMatch = q.match(/^(detail|metadata|about)\s+(.+)/);
    if (detailMatch) {
      const name = detailMatch[2].trim().replace(/\s+/g, '_');
      const meta = getScreenMeta(name);
      const text = meta.error
        ? 'Screen tidak ditemukan.'
        : `Deskripsi: ${(meta.metadata as Record<string, unknown>)?.description || '-'}\nTujuan: ${(meta.metadata as Record<string, unknown>)?.purpose || '-'}`;
      await this.conn.sessionUpdate({
        sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } },
      });
      return { stopReason: 'end_turn' };
    }

    // ── AI queries via Claude Code ──
    try {
      const screens = listScreens() as Record<string, unknown>;
      const screenNames = ((screens.screens as string[]) || []).join(', ');
      const prompt = `Kamu asisten design review MoneyKitty. Screen yang tersedia: ${screenNames || '(none)'}\n\nPertanyaan: ${userText}\n\nJawab singkat dan informatif.`;

      const claudeBin = process.env.CLAUDE_BIN_PATH || 'claude';
      const claude = spawn(
        claudeBin,
        ['-p', prompt, '--output-format', 'stream-json', '--include-partial-messages', '--verbose', '--bare', '--tools', '', '--permission-mode', 'auto', '--no-session-persistence'],
        { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } },
      );

      this.activeClaude = { process: claude, killed: false };

      let buffer = '';
      let fullText = '';

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
              this.conn.sessionUpdate({
                sessionId,
                update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } },
              }).catch(() => {});
            }
          } catch { /* skip */ }
        }
      });

      await new Promise<void>((resolve, reject) => {
        claude.on('close', (code) => {
          this.activeClaude = null;
          if (code === 0 || fullText) resolve();
          else reject(new Error(`Claude exited ${code}`));
        });
        claude.on('error', reject);
      });

      return { stopReason: 'end_turn' };
    } catch (e) {
      await this.conn.sessionUpdate({
        sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: `Error: ${(e as Error).message}` } },
      });
      return { stopReason: 'end_turn' };
    }
  }

  async cancel(_params: CancelNotification): Promise<void> {
    if (this.activeClaude && !this.activeClaude.killed) {
      this.activeClaude.killed = true;
      this.activeClaude.process.kill('SIGKILL');
      this.activeClaude = null;
    }
  }
}

// ── Bootstrap: stdio transport ──

const encoder = new TextEncoder();

const writable = new WritableStream<Uint8Array>({
  write(chunk) { process.stdout.write(chunk); },
});

const readable = new ReadableStream<Uint8Array>({
  start(controller) {
    process.stdin.setEncoding('utf-8');
    let buffer = '';
    process.stdin.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) controller.enqueue(encoder.encode(line + '\n'));
      }
    });
    process.stdin.on('end', () => {
      if (buffer.trim()) controller.enqueue(encoder.encode(buffer));
      controller.close();
    });
  },
});

const stream = ndJsonStream(writable, readable);
const connection = new AgentSideConnection(
  (conn) => new DesignReviewAgent(conn),
  stream,
);

connection.closed.then(() => process.exit(0)).catch(() => process.exit(1));
