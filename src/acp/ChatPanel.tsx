import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { marked } from 'marked';
import {
  X, ChevronDown, Sparkles, BrainCircuit, Shield, ShieldCheck, ShieldOff,
  Paperclip, ArrowUp, History, Search, Key, MessageCircle, Check,
} from '../components/base/icons';
import type { MarkerContext } from '../types';
import {
  type ChatSession,
  loadSessions,
  saveSessions,
  loadActiveId,
  saveActiveId,
  createSession,
} from './sessions';
import { SessionPanel } from './SessionPanel';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  streaming?: boolean;
}

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

// ── Types and data ──

type ApprovalMode = 'auto' | 'semi_auto' | 'manual';
type ReasoningEffort = 'off' | 'low' | 'medium' | 'high' | 'max';

const APPROVAL_OPTIONS: {
  value: ApprovalMode;
  label: string;
  desc: string;
  icon: typeof Shield;
}[] = [
  { value: 'auto', label: 'Auto', desc: 'Tools run without approval', icon: ShieldOff },
  { value: 'semi_auto', label: 'Semi-auto', desc: 'Edits auto-approved, others need approval', icon: ShieldCheck },
  { value: 'manual', label: 'Manual', desc: 'All tools require approval', icon: Shield },
];

interface ModelDef {
  id: string;
  name: string;
  provider: 'Anthropic' | 'OpenAI';
  connected: boolean;
}

const MODELS: ModelDef[] = [
  { id: 'opus_47', name: 'Opus 4.7', provider: 'Anthropic', connected: true },
  { id: 'opus_46', name: 'Opus 4.6', provider: 'Anthropic', connected: true },
  { id: 'sonnet_46', name: 'Sonnet 4.6', provider: 'Anthropic', connected: true },
  { id: 'haiku_45', name: 'Haiku 4.5', provider: 'Anthropic', connected: true },
  { id: 'gpt_55', name: 'GPT 5.5', provider: 'OpenAI', connected: false },
];

const PROVIDERS = ['Anthropic', 'OpenAI'] as const;

const REASONING_OPTIONS: {
  value: ReasoningEffort;
  label: string;
  desc: string;
}[] = [
  { value: 'off', label: 'Off', desc: 'No extended thinking' },
  { value: 'low', label: 'Low', desc: 'Minimal reasoning effort' },
  { value: 'medium', label: 'Medium', desc: 'Moderate reasoning effort' },
  { value: 'high', label: 'High', desc: 'Thorough reasoning effort' },
  { value: 'max', label: 'Max', desc: 'Maximum reasoning effort' },
];

// ── Helpers ──

function getModelName(id: string): string {
  return MODELS.find((m) => m.id === id)?.name ?? id;
}

function getReasoningLabel(effort: ReasoningEffort): string {
  return REASONING_OPTIONS.find((o) => o.value === effort)?.label ?? effort;
}

function getApprovalLabel(mode: ApprovalMode): string {
  switch (mode) {
    case 'auto':
      return 'Auto';
    case 'semi_auto':
      return 'Semi-auto';
    case 'manual':
      return 'Manual';
  }
}

function getApprovalIcon(mode: ApprovalMode) {
  switch (mode) {
    case 'auto':
      return ShieldOff;
    case 'semi_auto':
      return ShieldCheck;
    case 'manual':
      return Shield;
  }
}

const DROPDOWN_WIDTHS: Record<string, number> = {
  approval: 280,
  model: 360,
  reasoning: 260,
};

// ── Component ──

export function ChatPanel({ currentScreen, markerContext, onResetMarker }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('auto');
  const [model, setModel] = useState('opus_47');
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('max');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ bottom: number; left: number }>({ bottom: 0, left: 0 });
  const [chatName, setChatName] = useState('New Chat');
  const [editingName, setEditingName] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  // ── Session state ──
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const loaded = loadActiveId();
    const existing = loadSessions();
    if (loaded && existing.some((s) => s.id === loaded)) return loaded;
    return null;
  });
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);

  // Refs for safe access in closures / event handlers
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Session initialisation (mount only) ──

  useEffect(() => {
    if (!activeSessionId) {
      // No active session — create a new one
      const session = createSession();
      setSessions([session]);
      setActiveSessionId(session.id);
      saveActiveId(session.id);
      return;
    }
    // Restore existing session
    const session = sessions.find((s) => s.id === activeSessionId);
    if (session) {
      setMessages(session.messages);
      setChatName(session.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load session data when switching active session ──

  useEffect(() => {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session) return;
    setMessages(session.messages);
    setChatName(session.name);
  }, [activeSessionId]);

  // ── Debounced auto-sync messages into sessions state ──

  useEffect(() => {
    if (!activeSessionId) return;
    // Don't persist while streaming — wait for completion
    const last = messages[messages.length - 1];
    if (last?.streaming) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const msgs = messagesRef.current;
      const id = activeSessionIdRef.current;
      if (!id) return;
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], messages: msgs, updatedAt: Date.now() };
        return next;
      });
    }, 400);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ── Debounced persist to localStorage ──

  useEffect(() => {
    const timer = setTimeout(() => {
      saveSessions(sessions);
    }, 800);
    return () => clearTimeout(timer);
  }, [sessions]);

  // ── Sync to localStorage before unload ──

  useEffect(() => {
    const handleBeforeUnload = () => {
      const msgs = messagesRef.current;
      const id = activeSessionIdRef.current;
      const all = sessionsRef.current;
      if (!id) return;
      const idx = all.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const updated = [...all];
      updated[idx] = { ...updated[idx], messages: msgs, updatedAt: Date.now() };
      saveSessions(updated);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── Existing effects ──

  // Auto-scroll on new messages
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
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  // Auto-focus search input when model dropdown opens
  useEffect(() => {
    if (activeDropdown === 'model' && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (activeDropdown !== 'model') {
      setModelSearch('');
    }
  }, [activeDropdown]);

  // Auto-focus name input when editing
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!activeDropdown) return;

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Ignore clicks inside dropdowns or on trigger buttons
      if (target.closest('.chat-dropdown') || target.closest('[data-dropdown-trigger]')) return;
      setActiveDropdown(null);
    }

    // Use mousedown so it fires before any click handlers on the same event
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [activeDropdown]);

  // ── Session management ──

  /** Commit current messages into the active session (used before switching). */
  function commitCurrentMessages() {
    const msgs = messagesRef.current;
    const id = activeSessionIdRef.current;
    if (!id) return;
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], messages: msgs, updatedAt: Date.now() };
      return next;
    });
  }

  function handleSelectSession(id: string) {
    commitCurrentMessages();
    setActiveSessionId(id);
    saveActiveId(id);
    setSessionPanelOpen(false);
  }

  function handleNewSession() {
    commitCurrentMessages();
    const session = createSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setMessages([]);
    setChatName('New Chat');
    saveActiveId(session.id);
    setSessionPanelOpen(false);
  }

  function handleDeleteSession(id: string) {
    const session = sessionsRef.current.find((s) => s.id === id);
    if (!session) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    // If we deleted the active session, create a new one
    if (id === activeSessionIdRef.current) {
      const remaining = sessionsRef.current.filter((s) => s.id !== id);
      if (remaining.length > 0) {
        const nextActive = remaining[0];
        setActiveSessionId(nextActive.id);
        saveActiveId(nextActive.id);
      } else {
        const newSession = createSession();
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        setChatName('New Chat');
        saveActiveId(newSession.id);
      }
    }
  }

  // ── Send / streaming logic ──

  async function send(query: string) {
    if (!query.trim() || loading) return;

    abortRef.current?.abort();

    setMessages((prev) => [...prev, { role: 'user', text: query }]);
    setInput('');
    setLoading(true);
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

      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('x-ndjson')) {
        const reader = res.body!.getReader();

        await readNdjsonStream(
          reader,
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

  // ── Dropdown helpers ──

  function openDropdown(type: string, e: React.MouseEvent) {
    if (activeDropdown === type) {
      setActiveDropdown(null);
      return;
    }
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const w = DROPDOWN_WIDTHS[type] || 280;

    let left = rect.left;
    if (left + w > window.innerWidth - 8) {
      left = window.innerWidth - w - 8;
    }

    setDropdownPos({ bottom: window.innerHeight - rect.top + 4, left });
    setActiveDropdown(type);
  }

  const hasMessages = messages.length > 0;
  const ApprovalIcon = getApprovalIcon(approvalMode);
  const currentModel = MODELS.find((m) => m.id === model);

  return (
    <div className="chat-panel">
      {/* ── Header Bar ── */}
      <div className="chat-header">
        <div className="chat-header-left">
          {editingName ? (
            <div className="chat-name-edit">
              <input
                ref={nameInputRef}
                className="chat-name-input"
                value={chatName}
                onChange={(e) => {
                  setChatName(e.target.value);
                  // Sync name to session in real-time
                  const id = activeSessionIdRef.current;
                  if (id) {
                    setSessions((prev) =>
                      prev.map((s) =>
                        s.id === id ? { ...s, name: e.target.value } : s,
                      ),
                    );
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditingName(false);
                  if (e.key === 'Escape') { setChatName('New Chat'); setEditingName(false); }
                }}
                onBlur={() => setEditingName(false)}
              />
            </div>
          ) : (
            <button type="button" className="chat-name-btn" onClick={() => setEditingName(true)}>
              {chatName}
            </button>
          )}
        </div>
        <div className="chat-header-actions">
          <button
            type="button"
            className="chat-header-btn"
            title="History"
            onClick={() => setSessionPanelOpen((prev) => !prev)}
          >
            <History size={20} />
          </button>
        </div>
      </div>

      {/* ── Marker Context Banner ── */}
      {markerContext && (
        <div className="chat-marker-banner">
          <span className="chat-marker-banner-label">
            {markerContext.element?.caiId ? (
              <>Marked: <strong>cai-id=&ldquo;{markerContext.element.caiId}&rdquo;</strong></>
            ) : (
              <>
                Marked: &lt;{markerContext.element?.tag}&gt;
                &ldquo;{(markerContext.element?.text ?? '').substring(0, 35)}&rdquo;
              </>
            )}
          </span>
          {onResetMarker && (
            <button type="button" className="chat-marker-banner-close" onClick={onResetMarker} title="Clear marker">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* ── Content: Empty State or Messages ── */}
      {!hasMessages ? (
        <div className="chat-empty-state">
          <div className="chat-empty-icon">
            <MessageCircle size={48} />
          </div>
          <div className="chat-empty-title">Start a conversation</div>
          <div className="chat-empty-subtitle">Ask anything to get started</div>
        </div>
      ) : (
        <div className="chat-messages-area">
          <div ref={listRef} className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-message-row ${m.role}`}>
                <div className={`chat-message-bubble ${m.role}${m.error ? ' error' : ''}`}>
                  <span dangerouslySetInnerHTML={{ __html: marked.parse(m.text) as string }} />
                  {m.streaming && <span className="chat-cursor">|</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat Composer ── */}
      <div className="chat-composer">
        <div className="chat-textarea-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Ask to make changes, @mention files, run /commands"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
          />
          <span className="chat-textarea-shortcut">⌘J to focus</span>
        </div>

        {/* Control Bar */}
        <div className="chat-control-bar">
          <div className="chat-control-left">
            {/* Approval Mode */}
            <div className="chat-chip-wrapper">
              <button
                type="button"
                className="chat-chip"
                onClick={(e) => openDropdown('approval', e)}
                data-dropdown-trigger="approval"
              >
                <ApprovalIcon size={14} />
                <span>{getApprovalLabel(approvalMode)}</span>
                <ChevronDown size={12} />
              </button>
            </div>

            {/* Model Selector */}
            <div className="chat-chip-wrapper">
              <button
                type="button"
                className="chat-chip"
                onClick={(e) => openDropdown('model', e)}
                data-dropdown-trigger="model"
              >
                <Sparkles size={14} className="chat-chip-sparkle" />
                <span>{getModelName(model)}</span>
                <ChevronDown size={12} />
              </button>
            </div>

            {/* Reasoning Effort */}
            <div className="chat-chip-wrapper">
              <button
                type="button"
                className="chat-chip"
                onClick={(e) => openDropdown('reasoning', e)}
                data-dropdown-trigger="reasoning"
              >
                <BrainCircuit size={14} className="chat-chip-brain" />
                <span>{getReasoningLabel(reasoningEffort)}</span>
                <ChevronDown size={12} />
              </button>
            </div>
          </div>

          <div className="chat-control-right">
            <button type="button" className="chat-icon-btn" title="Attach files">
              <Paperclip size={20} />
            </button>
            <button
              type="button"
              className="chat-send-btn"
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              title="Send"
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Approval Mode Dropdown ── */}
      {activeDropdown === 'approval' && (
        <div
          className="chat-dropdown chat-approval-dropdown"
          style={{ bottom: dropdownPos.bottom, left: dropdownPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {APPROVAL_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={`chat-approval-item${approvalMode === opt.value ? ' selected' : ''}`}
              onClick={() => {
                setApprovalMode(opt.value);
                setActiveDropdown(null);
              }}
            >
              <span className="chat-approval-item-icon">
                <opt.icon size={18} />
              </span>
              <span className="chat-approval-item-text">
                <span className="chat-approval-item-label">{opt.label}</span>
                <span className="chat-approval-item-desc">{opt.desc}</span>
              </span>
              {approvalMode === opt.value && (
                <span className="chat-approval-item-check">
                  <Check size={16} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Model Selector Dropdown ── */}
      {activeDropdown === 'model' && (
        <div
          className="chat-dropdown chat-model-dropdown"
          style={{ bottom: dropdownPos.bottom, left: dropdownPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Header */}
          <div className="chat-model-search">
            <div className="chat-model-search-input-wrapper">
              <span className="chat-model-search-icon">
                <Search size={16} />
              </span>
              <input
                ref={searchInputRef}
                className="chat-model-search-input"
                type="text"
                placeholder="Search models..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
              />
              {modelSearch && (
                <button
                  type="button"
                  className="chat-model-search-clear"
                  onClick={() => setModelSearch('')}
                  tabIndex={-1}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Provider Groups */}
          {PROVIDERS.map((provider) => {
            const providerModels = MODELS.filter((m) => m.provider === provider);
            const filtered = modelSearch
              ? providerModels.filter((m) =>
                  m.name.toLowerCase().includes(modelSearch.toLowerCase()),
                )
              : providerModels;

            if (filtered.length === 0) return null;

            return (
              <div key={provider}>
                <div className="chat-model-provider">
                  <div className="chat-model-provider-header">
                    <span className="chat-model-provider-name">{provider}</span>
                    <span
                      className={`chat-model-provider-status${
                        providerModels[0].connected ? ' connected' : ' disconnected'
                      }`}
                    >
                      {providerModels[0].connected ? 'Connected' : 'Not connected'}
                      <span className="chat-model-provider-status-icon">
                        <Key size={14} />
                      </span>
                    </span>
                  </div>
                </div>
                {filtered.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className={`chat-model-item${model === m.id ? ' selected' : ''}`}
                    onClick={() => {
                      setModel(m.id);
                      setActiveDropdown(null);
                    }}
                    style={!m.connected ? { opacity: 0.6 } : undefined}
                  >
                    <span className="chat-model-item-icon">
                      <Sparkles size={16} />
                    </span>
                    <span className="chat-model-item-name">{m.name}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Reasoning Effort Dropdown ── */}
      {activeDropdown === 'reasoning' && (
        <div
          className="chat-dropdown chat-reasoning-dropdown"
          style={{ bottom: dropdownPos.bottom, left: dropdownPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {REASONING_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={`chat-reasoning-item${reasoningEffort === opt.value ? ' selected' : ''}`}
              onClick={() => {
                setReasoningEffort(opt.value);
                setActiveDropdown(null);
              }}
            >
              <span className="chat-reasoning-item-text">
                <span className="chat-reasoning-item-label">{opt.label}</span>
                <span className="chat-reasoning-item-desc">{opt.desc}</span>
              </span>
              {reasoningEffort === opt.value && (
                <span className="chat-reasoning-item-check">
                  <Check size={16} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Session Panel ── */}
      {sessionPanelOpen && (
        <SessionPanel
          sessions={sessions}
          activeId={activeSessionId}
          onSelect={handleSelectSession}
          onNew={handleNewSession}
          onDelete={handleDeleteSession}
          onClose={() => setSessionPanelOpen(false)}
        />
      )}
    </div>
  );
}
