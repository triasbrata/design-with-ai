/**
 * Standalone ACP Agent for the Design Review Viewer.
 *
 * Implements the ACP Agent interface over stdio. Spawn this process from
 * any ACP-compatible client (Claude Code, Zed) to enable design review queries.
 *
 * Usage: npx tsx src/acp/agent.ts
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

class DesignReviewAgent implements Agent {
  private conn: AgentSideConnection;

  constructor(conn: AgentSideConnection) {
    this.conn = conn;
  }

  async initialize(_params: InitializeRequest): Promise<InitializeResponse> {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: { loadSession: false },
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

    // Send a session update with available tool info
    await this.conn.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: 'Design Review Agent connected. Tools available via extension methods: designReview_listScreens, designReview_getScreenMeta, designReview_listSpecFiles.',
        },
      },
    });

    return { stopReason: 'end_turn' };
  }

  async cancel(_params: CancelNotification): Promise<void> {
    // No-op for server-side execution
  }
}

// ── Bootstrap: stdio transport ──

const encoder = new TextEncoder();

const writable = new WritableStream<Uint8Array>({
  write(chunk) {
    process.stdout.write(chunk);
  },
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
  stream
);

connection.closed.then(() => process.exit(0)).catch(() => process.exit(1));
