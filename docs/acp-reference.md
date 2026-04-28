# ACP — Agent Client Protocol Reference

> Dokumentasi lengkap ACP untuk integrasi di project design review viewer.
> Source: https://agentclientprotocol.com + TypeScript SDK v0.20.0.

---

## 1. Apa Itu ACP

**Agent Client Protocol (ACP)** — standar komunikasi antara code editor/IDE dan AI coding agent. Analogi: LSP untuk language server, ACP untuk AI agent.

Tujuan:
- Decouple editor dari agent implementation
- Satu ACP agent work di semua ACP-compatible editor
- Stream real-time progress (text, tool calls, plans)

---

## 2. Arsitektur

```
┌──────────────────────┐       JSON-RPC 2.0        ┌──────────────────────┐
│      Client          │  ◄────────────────────►    │       Agent          │
│   (Editor/IDE)       │       over stdio           │   (AI Assistant)     │
│                      │                            │                      │
│  ClientSideConnection│                            │  AgentSideConnection │
│  implements Client   │                            │  implements Agent    │
└──────────────────────┘                            └──────────────────────┘
```

**Client** (editor side):
- Spawn agent sebagai subprocess
- Kirim user prompts via `session/prompt`
- Terima streaming updates via `session/update`
- Handle permission requests dari agent

**Agent** (server side):
- Baca JSON-RPC dari stdin, tulis ke stdout
- Proses prompts pake LLM
- Stream progress, tool calls, plans
- Request permission untuk sensitive operations

**Transport:** stdio via `ndJsonStream(WritableStream, ReadableStream)`:
```
Stream { readable: ReadableStream<AnyMessage>, writable: WritableStream<AnyMessage> }
```
- Messages delimitted oleh `\n`
- UTF-8 encoding
- Agent boleh tulis logging ke stderr

---

## 3. Lifecycle

```
Client                              Agent
  │                                   │
  ├── initialize ──────────────────►  │  Negotiate version + capabilities
  │  ◄─────────────────── result ──┤  │
  │                                   │
  ├── authenticate ────────────────►  │  (jika auth required)
  │  ◄─────────────────── result ──┤  │
  │                                   │
  ├── session/new ────────────────►  │  Create conversation session
  │  ◄──────── { sessionId } ─────┤  │
  │                                   │
  ├── session/prompt ─────────────►  │  User sends message
  │                                   │
  │  ◄── session/update (plan) ───┤  │  Agent's execution plan
  │  ◄── session/update (chunk) ──┤  │  Streaming text
  │  ◄── session/update (tool) ───┤  │  Tool call started
  │  │  session/request_permission │  │  Permission request (optional)
  │  ├── permission response ─────►  │
  │  ◄── session/update (update) ─┤  │  Tool call progress
  │  ◄── session/update (update) ─┤  │  Tool call completed
  │  ... (loop LLM ↔ tool) ...       │
  │                                   │
  │  (atau session/cancel)            │
  │                                   │
  │  ◄─── PromptResponse ─────────┤  │  StopReason: end_turn/cancelled/etc
```

---

## 4. Initialization

**Request** (Client → Agent):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": 1,
    "clientCapabilities": {
      "fs": { "readTextFile": true, "writeTextFile": false },
      "terminal": false
    },
    "clientInfo": { "name": "my-editor", "version": "1.0.0" }
  }
}
```

**Response** (Agent → Client):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "loadSession": false,
      "promptCapabilities": { "image": false, "audio": false, "embeddedContext": false },
      "mcpCapabilities": { "http": false, "sse": false },
      "sessionCapabilities": {}
    },
    "authMethods": [],
    "agentInfo": { "name": "my-agent", "version": "1.0.0" }
  }
}
```

**Agent Capabilities:**
| Field | Type | Default | Description |
|---|---|---|---|
| `loadSession` | boolean | false | Dukung session/load |
| `promptCapabilities.image` | boolean | false | Terima ImageContent |
| `promptCapabilities.audio` | boolean | false | Terima AudioContent |
| `promptCapabilities.embeddedContext` | boolean | false | Terima EmbeddedResource |
| `mcpCapabilities.http` | boolean | false | Konek MCP via HTTP |
| `mcpCapabilities.sse` | boolean | false | Konek MCP via SSE |
| `sessionCapabilities.close` | object | null | Dukung session/close |
| `sessionCapabilities.list` | object | null | Dukung session/list |
| `sessionCapabilities.resume` | object | null | Dukung session/resume |

**Semua agent WAJIB support:** `ContentBlock::Text` dan `ContentBlock::ResourceLink` di prompt.

Protocol version = integer. Bump hanya untuk breaking changes.

---

## 5. Authentication

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "authenticate",
  "params": { "methodId": "env_var" }
}
```

**Response:**
```json
{ "jsonrpc": "2.0", "id": 1, "result": {} }
```

Auth method types:
- `env_var` — baca dari environment variable
- `terminal` — prompt user di terminal
- `agent` — agent handle sendiri (default)

Dipanggil setelah initialize, sebelum session/new. Wajib hanya jika initialize return `authMethods` tidak kosong.

---

## 6. Session Management

### session/new — Create Session

**Request:**
```json
{
  "jsonrpc": "2.0", "id": 1, "method": "session/new",
  "params": {
    "cwd": "/home/user/project",
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "/path/to/mcp-server",
        "args": ["--stdio"],
        "env": []
      }
    ]
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": { "sessionId": "sess_abc123" }
}
```

### session/load — Restore Session

Hanya jika `loadSession: true`. Agent **wajib replay seluruh history** via `session/update` notifications sebelum respond.

### session/resume — Resume Without Replay

Hanya jika `sessionCapabilities.resume`. Agent restore context tanpa replay history.

### session/close

Hanya jika `sessionCapabilities.close`. Cancel ongoing work + free resources.

### session/list

Hanya jika `sessionCapabilities.list`. List sessions dengan pagination.

---

## 7. Prompt Turn

### Request (Client → Agent)
```json
{
  "jsonrpc": "2.0", "id": 1, "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc123",
    "prompt": [
      { "type": "text", "text": "Apa cuaca hari ini?" }
    ]
  }
}
```

### Streaming Updates (Agent → Client)

Semua update via `session/update` notification:

**1. Plan — execution plan**
```json
{
  "jsonrpc": "2.0", "method": "session/update",
  "params": {
    "sessionId": "sess_abc123",
    "update": {
      "sessionUpdate": "plan",
      "entries": [
        { "content": "Cek API cuaca", "priority": "high", "status": "in_progress" },
        { "content": "Format response", "priority": "medium", "status": "pending" }
      ]
    }
  }
}
```
Agent WAJIB kirim complete list setiap update. Client replace total.

**2. agent_message_chunk — text streaming**
```json
{
  "sessionUpdate": "agent_message_chunk",
  "content": { "type": "text", "text": "Cuaca hari ini ce..." }
}
```

**3. tool_call — tool invocation started**
```json
{
  "sessionUpdate": "tool_call",
  "toolCallId": "tc_001",
  "title": "Get Weather",
  "kind": "fetch",
  "status": "pending"
}
```

**4. tool_call_update — tool progress**
```json
{
  "sessionUpdate": "tool_call_update",
  "toolCallId": "tc_001",
  "status": "completed",
  "content": [{ "type": "content", "content": { "type": "text", "text": "32°C" } }]
}
```

**5. current_mode_update — mode switch**
```json
{
  "sessionUpdate": "current_mode_update",
  "currentModeId": "code"
}
```

**6. available_commands_update — slash commands**
```json
{
  "sessionUpdate": "available_commands_update",
  "availableCommands": [
    { "name": "web", "description": "Search the web", "input": { "hint": "search query" } }
  ]
}
```

**7. config_option_update — config change**
```json
{
  "sessionUpdate": "config_option_update",
  "configOptions": [...]
}
```

### Permission Request (Agent → Client)
```json
{
  "jsonrpc": "2.0", "id": 2, "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123",
    "toolCall": { "toolCallId": "tc_001", "title": "Get Weather", ... },
    "options": [
      { "optionId": "allow_once", "name": "Allow once", "kind": "allow_once" },
      { "optionId": "reject_once", "name": "Reject", "kind": "reject_once" }
    ]
  }
}
```

**Response:**
```json
{ "jsonrpc": "2.0", "id": 2, "result": { "outcome": "selected", "optionId": "allow_once" } }
```

### Response (Agent → Client)

Prompt turn ends ketika agent return stop reason:
```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": { "stopReason": "end_turn" }
}
```

**Stop Reasons:**
| Reason | Meaning |
|---|---|
| `end_turn` | LLM selesai, ga minta tool lagi |
| `max_tokens` | Token limit reached |
| `max_turn_requests` | Max model requests exceeded |
| `refusal` | Agent menolak lanjut |
| `cancelled` | Client cancel turn |

### Cancellation (Client → Agent)
```json
{
  "jsonrpc": "2.0", "method": "session/cancel",
  "params": { "sessionId": "sess_abc123" }
}
```
Agent HARUS: stop LLM requests, stop tool calls, respond ke `session/prompt` dengan `stopReason: "cancelled"`.

---

## 8. Content Types

ContentBlock = union type:

| Type | Fields | Requires Capability |
|---|---|---|
| `text` | `text: string` | Wajib (semua agent support) |
| `image` | `data: string` (base64), `mimeType: string` | `image` |
| `audio` | `data: string` (base64), `mimeType: string` | `audio` |
| `resource` | `resource: TextResourceContents \| BlobResourceContents` | `embeddedContext` |
| `resource_link` | `uri: string`, `name: string` | Wajib (semua agent support) |

Tool call content bisa include:
- **Regular content**: `{ type: "content", content: ContentBlock }`
- **Diff**: `{ type: "diff", path: "/file.ts", oldText: "...", newText: "..." }`
- **Terminal**: `{ type: "terminal", terminalId: "term_123" }`

---

## 9. Tool Call Lifecycle

```
pending → in_progress → completed
                      → failed
```

**Tool kinds:**
| Kind | Purpose |
|---|---|
| `read` | Baca file/data |
| `edit` | Modifikasi file |
| `delete` | Hapus file/data |
| `move` | Pindah/rename file |
| `search` | Cari informasi |
| `execute` | Run commands |
| `think` | Internal reasoning |
| `fetch` | Ambil data external |
| `other` | Default |

**Permission options:**
| Kind | Meaning |
|---|---|
| `allow_once` | Izinkan sekali |
| `allow_always` | Izinkan dan ingat |
| `reject_once` | Tolak sekali |
| `reject_always` | Tolak dan ingat |

Jika prompt turn di-cancel, client harus respond `outcome: "cancelled"` ke pending `request_permission`.

---

## 10. Session Modes & Config Options

### Modes (legacy, bakal dihapus)

Agent return `modes` array di `session/new` response:
```json
{
  "modes": {
    "availableModes": [
      { "id": "ask", "name": "Ask", "description": "Minta izin sebelum changes" },
      { "id": "code", "name": "Code", "description": "Write code with full access" }
    ],
    "currentModeId": "ask"
  }
}
```

Set mode: `session/set_mode` dengan `sessionId` + `modeId`.

### Config Options (preferred)

Return `configOptions` array di `session/new` response:
```json
{
  "configOptions": [
    {
      "id": "mode",
      "name": "Mode",
      "category": "mode",
      "type": "select",
      "currentValue": "ask",
      "options": [
        { "value": "ask", "name": "Ask" },
        { "value": "code", "name": "Code" }
      ]
    }
  ]
}
```

Categories reserved: `mode`, `model`, `thought_level`, `_custom`.

Set value: `session/set_config_option` dengan `configId` + `value`.
Agent respond dengan **complete** config state.

---

## 11. File System

### readTextFile
```json
{
  "method": "fs/read_text_file",
  "params": { "sessionId": "sess_abc", "path": "/abs/path/file.ts", "line": 1, "limit": 50 }
}
```
Response: `{ "content": "file contents..." }`

### writeTextFile
```json
{
  "method": "fs/write_text_file",
  "params": { "sessionId": "sess_abc", "path": "/abs/path/file.ts", "content": "new content" }
}
```
Response: `{}`

Keduanya require client capability `fs.readTextFile` / `fs.writeTextFile = true`.

---

## 12. Terminal Management

```json
// Create
{ "method": "terminal/create", "params": { "sessionId": "...", "command": "node", "args": ["script.js"], "cwd": "/project" } }
// Response: { "terminalId": "term_xyz" }

// Get output (non-blocking)
{ "method": "terminal/output", "params": { "sessionId": "...", "terminalId": "term_xyz" } }
// Response: { "output": "...", "truncated": false, "exitStatus": null }

// Wait for exit (blocking)
{ "method": "terminal/wait_for_exit", "params": { "sessionId": "...", "terminalId": "term_xyz" } }
// Response: { "exitCode": 0, "signal": null }

// Kill command
{ "method": "terminal/kill", "params": { "sessionId": "...", "terminalId": "term_xyz" } }

// Release (free resources)
{ "method": "terminal/release", "params": { "sessionId": "...", "terminalId": "term_xyz" } }
```

Output bisa diembed di tool call content: `{ "type": "terminal", "terminalId": "term_xyz" }`.

WAJIB release terminal setelah selesai. Combine dengan timeout pattern: create → race waitForExit vs timer → kill + getOutput → release.

---

## 13. Slash Commands

Agent advertise via `available_commands_update` notification:
```json
{
  "sessionUpdate": "available_commands_update",
  "availableCommands": [
    { "name": "web", "description": "Search the web", "input": { "hint": "search query" } }
  ]
}
```

Client kirim command sebagai text prompt biasa: `/web agent client protocol`. Agent detect prefix `/` dan proses sesuai.

Bisa diupdate kapan aja selama session.

---

## 14. Extensibility

| Mechanism | Cara | Constraint |
|---|---|---|
| `_meta` field | Semua types punya `_meta: { [key: string]: unknown }` | Root field names reserved |
| Custom requests | Method name mulai `_` | Harus respond; unknown return -32601 |
| Custom notifications | Method name mulai `_`, no `id` | Silently ignore if unknown |
| Custom capabilities | `agentCapabilities._meta` / `clientCapabilities._meta` | SHOULD declare extensions |

---

## 15. TypeScript SDK (@agentclientprotocol/sdk v0.20.0)

### AgentSideConnection

```typescript
import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';

const stream = ndJsonStream(
  Writable.toWeb(process.stdout),
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
);

const conn = new AgentSideConnection(
  (conn) => new MyAgent(conn),
  stream,
);

await conn.closed; // cleanup
```

**Agent interface (wajib diimplementasi):**
```typescript
interface Agent {
  initialize(params: InitializeRequest): Promise<InitializeResponse>;
  authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse | void>;
  newSession(params: NewSessionRequest): Promise<NewSessionResponse>;
  prompt(params: PromptRequest): Promise<PromptResponse>;
  cancel(params: CancelNotification): Promise<void>;
  // optional: loadSession, closeSession, setSessionMode, etc.
}
```

**AgentSideConnection methods (call dari agent ke client):**
| Method | Purpose |
|---|---|
| `sessionUpdate(params)` | Stream progress: chunks, tool calls, plans |
| `requestPermission(params)` | Minta izin user untuk tool execution |
| `readTextFile(params)` | Baca file dari editor |
| `writeTextFile(params)` | Tulis file di editor |
| `createTerminal(params)` | Execute command |
| `extMethod(method, params)` | Custom request |
| `extNotification(method, params)` | Custom notification |

### ClientSideConnection

```typescript
import { ClientSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';
import { spawn } from 'node:child_process';

const proc = spawn('npx', ['tsx', 'agent.ts'], { stdio: ['pipe', 'pipe', 'inherit'] });

const stream = ndJsonStream(
  Writable.toWeb(proc.stdin!),
  Readable.toWeb(proc.stdout!) as ReadableStream<Uint8Array>,
);

const conn = new ClientSideConnection((agent) => new MyClient(), stream);

await conn.initialize({ protocolVersion: 1, clientCapabilities: { fs: { readTextFile: true, writeTextFile: false }, terminal: false } });
await conn.newSession({ cwd: process.cwd(), mcpServers: [] });
const result = await conn.prompt({ sessionId, prompt: [{ type: "text", text: "Hello" }] });
```

**Client interface (wajib diimplementasi):**
```typescript
interface Client {
  requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  sessionUpdate(params: SessionNotification): Promise<void>;
  // optional: readTextFile, writeTextFile, createTerminal, etc.
}
```

### Stream & ndJsonStream

```typescript
type Stream = {
  readable: ReadableStream<AnyMessage>;
  writable: WritableStream<AnyMessage>;
};

function ndJsonStream(
  output: WritableStream<Uint8Array>,  // stdout
  input: ReadableStream<Uint8Array>,    // stdin
): Stream;
```
- Readable: accumulate lines split by `\n`, parse each line as JSON
- Writable: JSON.stringify + `\n` each message, encode as UTF-8

---

## 16. Implementation di Project Ini

### Hybrid Architecture

```
┌─────────────┐   fetch POST   ┌──────────────────┐   spawn    ┌────────────┐
│  Web UI     │ ──────────────►│  Vite Middleware  │ ──────────►│ Claude CLI │
│  ChatPanel  │ ◄──────────────┤  (acp-vite-plugin)│ ◄──────────┤ claude -p  │
└─────────────┘   JSON resp    └──────────────────┘   stdout    └────────────┘
```

**Flow:**
1. User ketik di ChatPanel → fetch POST `/api/acp/chat`
2. Middleware detect:
   - Tool query (e.g. "list screens") → instant response dari `tools.ts`
   - AI query → spawn `claude -p` dengan prompt context
3. Response balik sebagai JSON `{ response: string }`

**Komponen:**
| File | Role |
|---|---|
| `src/acp/acp-vite-plugin.ts` | Vite middleware: HTTP endpoints |
| `src/acp/tools.ts` | Tool implementations + definitions |
| `src/acp/ChatPanel.tsx` | React chat UI |
| `src/acp/DrawerTabs.tsx` | Tab switcher (Chat + Agent) |
| `src/acp/AgentPanel.tsx` | ACP connection status display |
| `src/acp/agent.ts` | Standalone ACP Agent (stdin/stdout) |
| `src/acp/useAcpBridge.ts` | React hook: ACP connectivity check |

**Arah ke depan (proper ACP):**
1. Fix `agent.ts` jadi real agent yang spawn `claude` di `session/prompt`, stream hasil via `session/update` notifications
2. Ganti HTTP middleware pake `ClientSideConnection` yang spawn agent.ts sebagai subprocess
3. Web UI tetap pake fetch — bedanya backend jadi ACP-native

---

## 17. Referensi

- [ACP Docs](https://agentclientprotocol.com)
- [TypeScript SDK (GitHub)](https://github.com/agentclientprotocol/typescript-sdk)
- [TypeScript SDK API Reference](https://agentclientprotocol.github.io/typescript-sdk)
- [Gemini CLI — production ACP agent reference](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/zed-integration/zedIntegration.ts)
- [SDK Examples](https://github.com/agentclientprotocol/typescript-sdk/tree/main/src/examples)
- [llms.txt — complete doc index](https://agentclientprotocol.com/llms.txt)
