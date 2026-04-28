import { useState, useRef, useEffect, type FormEvent } from 'react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
}

const QUICK_ACTIONS = [
  { label: 'List screens', query: 'List all design review screens' },
  { label: 'Current screen', query: 'Show metadata for current screen' },
  { label: 'Tools', query: 'What ACP tools are available?' },
];

interface ChatPanelProps {
  connected: boolean;
  currentScreen?: string;
}

export function ChatPanel({ connected, currentScreen }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: connected
        ? 'Connected to Claude Code. Ask about the design review project.'
        : 'Dev server running. Claude Code not detected — using local tools.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleQuery(query: string) {
    if (!query.trim() || loading) return;

    const userMsg: Message = { role: 'user', text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/acp/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          context: { currentScreen },
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { response: string; note?: string };
      const text = data.response || '(empty response)';
      const note = data.note ? `\n\n— ${data.note}` : '';

      setMessages((prev) => [...prev, { role: 'assistant', text: text + note }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Failed to reach Claude Code. Make sure it is installed and try again.',
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    handleQuery(input);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
      }}
    >
      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            className="chat-quick-btn"
            onClick={() => handleQuery(a.query)}
            disabled={loading}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginBottom: 8,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-bubble ${m.role}${m.error ? ' error' : ''}`}
          >
            {m.text}
          </div>
        ))}
        {loading && <div className="chat-bubble assistant loading">Thinking...</div>}
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} className="chat-form">
        <input
          className="chat-input"
          placeholder="Ask Claude Code..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          type="submit"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
