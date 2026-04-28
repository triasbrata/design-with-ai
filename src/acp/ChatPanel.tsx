import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Send, X } from '../components/base/icons';
import type { MarkerContext } from '../types';

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
  markerContext?: MarkerContext | null;
  onResetMarker?: () => void;
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

export function ChatPanel({ currentScreen, markerContext, onResetMarker }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Tanya tentang design review. Tool query langsung jawab, AI query streaming dari Claude.\n\nKetik "list screens" atau tanya apa aja!' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Auto-resize textarea on input change
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 60) + 'px';
  }, [input]);

  async function send(query: string) {
    if (!query.trim() || loading) return;

    // Cancel previous stream if any
    abortRef.current?.abort();

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', text: query }]);
    setInput('');
    setLoading(true);

    // Add placeholder assistant message (will be updated by streaming)
    setMessages((prev) => [...prev, { role: 'assistant', text: '', streaming: true }]);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch('/api/acp/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          context: {
            currentScreen,
            queryParam: currentScreen ? `?file=${currentScreen}` : undefined,
            markerContext: markerContext || undefined,
          },
        }),
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
            onResetMarker?.();
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
        onResetMarker?.();
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="chat-container">
      {/* Marker context indicator */}
      {markerContext && (
        <div className="chat-marker-banner">
          <span className="chat-marker-label">
            {markerContext.element?.caiId ? (
              <>Marked: <strong>cai-id=&ldquo;{markerContext.element.caiId}&rdquo;</strong></>
            ) : (
              <>Marked: &lt;{markerContext.element?.tag}&gt;{' '}
                &ldquo;{(markerContext.element?.text ?? '').substring(0, 35)}&rdquo;</>
            )}
          </span>
          {onResetMarker && (
            <button className="chat-marker-close" onClick={onResetMarker} title="Clear marker">
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="chat-actions">
        {QUICK_ACTIONS.map((a) => (
          <button key={a.label} className="chat-quick-btn" onClick={() => send(a.query)} disabled={loading}>
            {a.label}
          </button>
        ))}
        {loading && (
          <button className="chat-quick-btn chat-quick-btn--stop" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={listRef} className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">Ask something about the design...</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-row ${m.role}`}>
            {m.role === 'assistant' && <div className="chat-avatar">AI</div>}
            <div className={`chat-bubble ${m.role}${m.error ? ' error' : ''}`}>
              {m.text}
              {m.streaming && <span className="chat-cursor">|</span>}
            </div>
            {m.role === 'user' && <div className="chat-avatar">U</div>}
          </div>
        ))}
        {loading && messages[messages.length - 1]?.streaming !== true && (
          <div className="chat-row assistant">
            <div className="chat-avatar">AI</div>
            <div className="chat-bubble assistant loading">
              <div className="chat-dots">
                <span className="chat-dot" />
                <span className="chat-dot" />
                <span className="chat-dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="chat-form">
        <div className="chat-input-pill">
          <textarea
            ref={textareaRef}
            className="chat-input-field"
            placeholder="Ask about this design..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
          />
          <button className="chat-send-btn" type="submit" disabled={loading || !input.trim()}>
            <Send size={13} />
          </button>
        </div>
      </form>
    </div>
  );
}
