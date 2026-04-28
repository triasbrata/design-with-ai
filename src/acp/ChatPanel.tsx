import { useState, useRef, useEffect, type FormEvent } from 'react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  streaming?: boolean;
}

const QUICK_ACTIONS = [
  { label: 'List screens', query: 'list screens' },
  { label: 'Detail screen', query: 'detail record_screen_spec' },
];

interface ChatPanelProps {
  currentScreen?: string;
  markers?: { text: string; elementPath: string[]; rect: { x: number; y: number; width: number; height: number } }[];
}

/**
 * Read ndjson stream from a fetch Response body.
 * Calls onChunk for each line with type "chunk", onDone for "done".
 */
function readNdjsonStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (text: string) => void,
  onDone: (text: string) => void,
  onError: (msg: string) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  return reader.read().then(function process({ done, value }): Promise<void> | void {
    if (done) return;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        switch (parsed.type) {
          case 'chunk':
            onChunk(parsed.text as string);
            break;
          case 'done':
            onDone(parsed.text as string);
            reader.cancel();
            return;
          case 'error':
            onError(parsed.text as string);
            reader.cancel();
            return;
        }
      } catch {
        // skip malformed lines
      }
    }

    return reader.read().then(process);
  });
}

export function ChatPanel({ currentScreen, markers }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Tanya tentang design review. Tool query langsung jawab, AI query streaming dari Claude.\n\nKetik "list screens" atau tanya apa aja!' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function send(query: string) {
    if (!query.trim() || loading) return;

    // Cancel previous stream if any
    abortRef.current?.abort();

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', text: query }]);
    setInput('');
    setLoading(true);

    // Add placeholder assistant message (will be updated by streaming)
    const msgIndex = messages.length + 1; // after user message
    setMessages((prev) => [...prev, { role: 'assistant', text: '', streaming: true }]);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch('/api/acp/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, context: { currentScreen, markers } }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Check if response is ndjson (streaming) or json (tool query)
      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('x-ndjson')) {
        // Streaming response
        const reader = res.body!.getReader();

        await readNdjsonStream(
          reader,
          // onChunk
          (text) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, text: last.text + text, streaming: true };
              }
              return next;
            });
          },
          // onDone
          (fullText) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, text: fullText, streaming: false };
              }
              return next;
            });
            setLoading(false);
          },
          // onError
          (msg) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, text: msg, error: true, streaming: false };
              }
              return next;
            });
            setLoading(false);
          },
        );
      } else {
        // JSON response (tool query)
        const data = (await res.json()) as { response: string };
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, text: data.response || '(kosong)', streaming: false };
          }
          return next;
        });
        setLoading(false);
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = { ...last, text: 'Gagal terhubung ke server.', error: true, streaming: false };
        }
        return next;
      });
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {QUICK_ACTIONS.map((a) => (
          <button key={a.label} className="chat-quick-btn" onClick={() => send(a.query)} disabled={loading}>
            {a.label}
          </button>
        ))}
        {loading && (
          <button className="chat-quick-btn" style={{ color: '#C45353' }} onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        )}
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}${m.error ? ' error' : ''}`}>
            {m.text}
            {m.streaming && <span className="chat-cursor">▊</span>}
          </div>
        ))}
        {loading && messages[messages.length - 1]?.streaming !== true && (
          <div className="chat-bubble assistant loading">Claude mikir...</div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="chat-form">
        <input className="chat-input" placeholder="Tanya design review atau ngobrol pake Claude..." value={input} onChange={(e) => setInput(e.target.value)} disabled={loading} />
        <button className="chat-send-btn" type="submit" disabled={loading || !input.trim()}>Kirim</button>
      </form>
    </div>
  );
}
