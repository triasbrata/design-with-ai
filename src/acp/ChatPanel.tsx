import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';
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
    <div className="flex flex-col h-full overflow-hidden bg-[var(--brand-bg)] text-brand-text font-[-apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif]">
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-[var(--brand-border)] shrink-0 bg-bg-surface">
        <div className="flex items-center gap-1.5">
          {editingName ? (
            <div className="flex items-center">
              <input
                ref={nameInputRef}
                className="border-none border-b border-[var(--brand-accent-muted)] rounded-none outline-none py-0.5 px-0.5 font-inherit text-[15px] font-medium text-brand-text bg-transparent w-[180px]"
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
            <button type="button" className="inline-flex items-center px-1.5 py-0.5 border-none bg-transparent text-brand-text cursor-pointer font-inherit text-[15px] font-medium rounded hover:bg-primary_hover transition-[background] duration-150" onClick={() => setEditingName(true)}>
              {chatName}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex items-center justify-center w-7 h-7 rounded-[6px] border-none bg-transparent text-tertiary cursor-pointer transition-[background] duration-150 hover:bg-primary_hover p-0"
            title="History"
            onClick={() => setSessionPanelOpen((prev) => !prev)}
          >
            <History size={20} />
          </button>
        </div>
      </div>

      {/* ── Marker Context Banner ── */}
      {markerContext && (
        <div className="flex items-center gap-2 px-3 py-1.5 mx-3 mt-2 rounded-lg bg-[var(--brand-accent-light)] text-brand-solid text-[13px] shrink-0">
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
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
            <button type="button" className="flex items-center justify-center w-5 h-5 border-none rounded bg-transparent text-brand-solid cursor-pointer opacity-60 transition-[opacity,background] duration-150 hover:opacity-100 hover:bg-[rgba(196,83,83,0.12)] shrink-0 p-0" onClick={onResetMarker} title="Clear marker">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* ── Content: Empty State or Messages ── */}
      {!hasMessages ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <div className="text-tertiary opacity-50">
            <MessageCircle size={48} />
          </div>
          <div className="text-lg font-semibold text-brand-text text-center">Start a conversation</div>
          <div className="text-base text-tertiary text-center">Ask anything to get started</div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth">
          <div ref={listRef} className="flex flex-col gap-1.5 p-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex w-full animate-[chat-fade-in_0.2s_ease-out]", m.role === 'user' ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] px-3 py-2 rounded-[12px] text-[13px] leading-[1.5] break-words",
                  m.role === 'user'
                    ? "bg-[var(--brand-accent)] text-white border-b-[4px] border-b-[var(--brand-accent)] rounded-br-[4px]"
                    : "bg-bg-surface text-brand-text border border-[var(--brand-border-hairline)] rounded-bl-[4px]",
                  m.error && m.role === 'assistant' && "bg-[var(--brand-accent-light)] text-brand-solid border-transparent"
                )}>
                  <span dangerouslySetInnerHTML={{ __html: marked.parse(m.text) as string }} />
                  {m.streaming && <span className="animate-[chat-pulse_1.2s_ease-in-out_infinite] text-brand-solid opacity-70 ml-[1px]">|</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat Composer ── */}
      <div className="relative mx-4 mb-4 px-4 py-3 rounded-[16px] bg-bg-surface border border-[var(--brand-border)] shrink-0">
        <div className="relative">
          <textarea
            ref={textareaRef}
            className="w-full font-[-apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif] text-[15px] text-brand-text bg-transparent border-none outline-none resize-none min-h-[24px] max-h-[200px] leading-[1.5] p-0 pr-20 m-0 placeholder:text-[var(--brand-muted-light)]"
            placeholder="Ask to make changes, @mention files, run /commands"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
          />
          <span className="absolute top-0 right-0 text-[13px] text-[var(--brand-muted-light)] pointer-events-none">&lfloor;J to focus</span>
        </div>

        {/* Control Bar */}
        <div className="flex justify-between items-center mt-2 gap-2">
          <div className="flex gap-1.5 flex-nowrap overflow-x-auto min-w-0">
            {/* Approval Mode */}
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-[6px] border-none bg-primary_hover text-tertiary font-inherit text-[13px] font-medium cursor-pointer whitespace-nowrap transition-[background,color] duration-150 hover:bg-[var(--brand-border)] hover:text-brand-text"
                onClick={(e) => openDropdown('approval', e)}
                data-dropdown-trigger="approval"
              >
                <ApprovalIcon size={14} />
                <span>{getApprovalLabel(approvalMode)}</span>
                <ChevronDown size={12} />
              </button>
            </div>

            {/* Model Selector */}
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-[6px] border-none bg-primary_hover text-tertiary font-inherit text-[13px] font-medium cursor-pointer whitespace-nowrap transition-[background,color] duration-150 hover:bg-[var(--brand-border)] hover:text-brand-text"
                onClick={(e) => openDropdown('model', e)}
                data-dropdown-trigger="model"
              >
                <Sparkles size={14} className="text-[#fb923c]" />
                <span>{getModelName(model)}</span>
                <ChevronDown size={12} />
              </button>
            </div>

            {/* Reasoning Effort */}
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-[6px] border-none bg-primary_hover text-tertiary font-inherit text-[13px] font-medium cursor-pointer whitespace-nowrap transition-[background,color] duration-150 hover:bg-[var(--brand-border)] hover:text-brand-text"
                onClick={(e) => openDropdown('reasoning', e)}
                data-dropdown-trigger="reasoning"
              >
                <BrainCircuit size={14} className="text-[#6b7280]" />
                <span>{getReasoningLabel(reasoningEffort)}</span>
                <ChevronDown size={12} />
              </button>
            </div>
          </div>

          <div className="flex gap-2 items-center shrink-0">
            <button type="button" className="flex items-center justify-center w-7 h-7 rounded-[6px] border-none bg-transparent text-tertiary cursor-pointer transition-[background] duration-150 hover:bg-primary_hover p-0" title="Attach files">
              <Paperclip size={20} />
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-full border-none bg-brand-solid text-white cursor-pointer transition-[background,transform] duration-150 hover:bg-brand-solid_hover hover:scale-105 active:scale-95 disabled:bg-[var(--brand-accent-muted)] disabled:cursor-default disabled:scale-none p-0 shrink-0"
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
          className="fixed z-[var(--z-context-menu)] bg-bg-surface rounded-[12px] p-2 shadow-[0_8px_24px_var(--brand-shadow)] border border-[var(--brand-border)] w-[280px]"
          style={{ bottom: dropdownPos.bottom, left: dropdownPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {APPROVAL_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={cn(
                "flex items-center gap-2.5 w-full px-2.5 py-2 border-none rounded-lg bg-transparent text-brand-text font-inherit text-sm font-medium cursor-pointer text-left transition-[background] duration-150 hover:bg-primary_hover",
                approvalMode === opt.value && "bg-primary_hover"
              )}
              onClick={() => {
                setApprovalMode(opt.value);
                setActiveDropdown(null);
              }}
            >
              <span className="shrink-0 flex items-center text-tertiary">
                <opt.icon size={18} />
              </span>
              <span className="flex-1 flex flex-col gap-0.5">
                <span className="text-sm font-medium text-brand-text">{opt.label}</span>
                <span className="text-xs text-tertiary font-normal leading-[1.3]">{opt.desc}</span>
              </span>
              {approvalMode === opt.value && (
                <span className="shrink-0 flex items-center text-brand-solid">
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
          className="fixed z-[var(--z-context-menu)] bg-bg-surface rounded-[12px] p-2 shadow-[0_8px_24px_var(--brand-shadow)] border border-[var(--brand-border)] w-[360px]"
          style={{ bottom: dropdownPos.bottom, left: dropdownPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Header */}
          <div className="px-1 pb-2 border-b border-[var(--brand-border)] mb-1">
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-tertiary pointer-events-none flex items-center">
                <Search size={16} />
              </span>
              <input
                ref={searchInputRef}
                className="w-full h-10 pl-9 pr-8 rounded-lg border border-[var(--brand-border)] bg-primary_hover text-brand-text font-inherit text-sm outline-none focus:border-[var(--brand-accent-muted)] placeholder:text-[var(--brand-muted-light)]"
                type="text"
                placeholder="Search models..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
              />
              {modelSearch && (
                <button
                  type="button"
                  className="absolute right-1.5 flex items-center justify-center w-[22px] h-[22px] border-none rounded bg-transparent text-tertiary cursor-pointer p-0 hover:bg-primary_hover"
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
                <div className="px-2 pt-1.5 pb-0.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-brand-text">{provider}</span>
                    <span className={cn(
                      "flex items-center gap-1 text-xs text-tertiary",
                      providerModels[0].connected && "!text-[#16a34a]",
                      !providerModels[0].connected && "opacity-60"
                    )}>
                      {providerModels[0].connected ? 'Connected' : 'Not connected'}
                      <span className="flex items-center">
                        <Key size={14} />
                      </span>
                    </span>
                  </div>
                </div>
                {filtered.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-2 py-1.5 border-none rounded-lg bg-transparent text-brand-text font-inherit text-sm cursor-pointer text-left transition-[background] duration-150 hover:bg-primary_hover",
                      model === m.id && "!bg-brand-solid !text-white"
                    )}
                    onClick={() => {
                      setModel(m.id);
                      setActiveDropdown(null);
                    }}
                    style={!m.connected ? { opacity: 0.6 } : undefined}
                  >
                    <span className={cn(
                      "shrink-0 flex items-center",
                      model === m.id ? "text-white" : "text-[#fb923c]"
                    )}>
                      <Sparkles size={16} />
                    </span>
                    <span className="flex-1">{m.name}</span>
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
          className="fixed z-[var(--z-context-menu)] bg-bg-surface rounded-[12px] p-2 shadow-[0_8px_24px_var(--brand-shadow)] border border-[var(--brand-border)] w-[260px]"
          style={{ bottom: dropdownPos.bottom, left: dropdownPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {REASONING_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 border-none rounded-lg bg-transparent text-brand-text font-inherit text-sm cursor-pointer text-left transition-[background] duration-150 hover:bg-primary_hover",
                reasoningEffort === opt.value && "bg-primary_hover"
              )}
              onClick={() => {
                setReasoningEffort(opt.value);
                setActiveDropdown(null);
              }}
            >
              <span className="flex-1 flex flex-col gap-0.5">
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-tertiary font-normal leading-[1.3]">{opt.desc}</span>
              </span>
              {reasoningEffort === opt.value && (
                <span className="shrink-0 flex items-center text-brand-solid">
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
