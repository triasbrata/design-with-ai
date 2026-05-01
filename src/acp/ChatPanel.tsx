import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';
import { marked } from 'marked';
import {
  X, ChevronDown, Sparkles, BrainCircuit, Shield, ShieldCheck, ShieldOff,
  Paperclip, History, Search, Key, MessageCircle, Check,
} from '../components/base/icons';
import { Messaging } from '../components/application/messaging/messaging';
import type { Message } from '../components/application/messaging/messaging';
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

interface ChatMessage {
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
          case 'chunk': onChunk(parsed.text as string); break;
          case 'done': onDone(parsed.text as string); reader.cancel(); return;
          case 'error': onError(parsed.text as string); reader.cancel(); return;
        }
      } catch { /* skip malformed */ }
    }
    return reader.read().then(process);
  });
}

type ApprovalMode = 'auto' | 'semi_auto' | 'manual';
type ReasoningEffort = 'off' | 'low' | 'medium' | 'high' | 'max';

const APPROVAL_OPTIONS: { value: ApprovalMode; label: string; desc: string; icon: typeof Shield }[] = [
  { value: 'auto', label: 'Auto', desc: 'Tools run without approval', icon: ShieldOff },
  { value: 'semi_auto', label: 'Semi-auto', desc: 'Edits auto-approved, others need approval', icon: ShieldCheck },
  { value: 'manual', label: 'Manual', desc: 'All tools require approval', icon: Shield },
];

interface ModelDef { id: string; name: string; provider: 'Anthropic' | 'OpenAI'; connected: boolean; }

const MODELS: ModelDef[] = [
  { id: 'opus_47', name: 'Opus 4.7', provider: 'Anthropic', connected: true },
  { id: 'opus_46', name: 'Opus 4.6', provider: 'Anthropic', connected: true },
  { id: 'sonnet_46', name: 'Sonnet 4.6', provider: 'Anthropic', connected: true },
  { id: 'haiku_45', name: 'Haiku 4.5', provider: 'Anthropic', connected: true },
  { id: 'gpt_55', name: 'GPT 5.5', provider: 'OpenAI', connected: false },
];

const PROVIDERS = ['Anthropic', 'OpenAI'] as const;

const REASONING_OPTIONS: { value: ReasoningEffort; label: string; desc: string }[] = [
  { value: 'off', label: 'Off', desc: 'No extended thinking' },
  { value: 'low', label: 'Low', desc: 'Minimal reasoning effort' },
  { value: 'medium', label: 'Medium', desc: 'Moderate reasoning effort' },
  { value: 'high', label: 'High', desc: 'Thorough reasoning effort' },
  { value: 'max', label: 'Max', desc: 'Maximum reasoning effort' },
];

const DROPDOWN_WIDTHS: Record<string, number> = { approval: 280, model: 360, reasoning: 260 };

function getModelName(id: string) { return MODELS.find((m) => m.id === id)?.name ?? id; }
function getReasoningLabel(effort: ReasoningEffort) { return REASONING_OPTIONS.find((o) => o.value === effort)?.label ?? effort; }
function getApprovalLabel(mode: ApprovalMode): string { return mode === 'auto' ? 'Auto' : mode === 'semi_auto' ? 'Semi-auto' : 'Manual'; }
function getApprovalIcon(mode: ApprovalMode) { return mode === 'auto' ? ShieldOff : mode === 'semi_auto' ? ShieldCheck : Shield; }

// Convert internal messages to Messaging component format
function toMessage(m: ChatMessage, i: number): Message {
  return { id: String(i), role: m.role, content: m.text, error: m.error, streaming: m.streaming };
}

export function ChatPanel({ currentScreen, markerContext, onResetMarker }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const loaded = loadActiveId();
    const existing = loadSessions();
    if (loaded && existing.some((s) => s.id === loaded)) return loaded;
    return null;
  });
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Session init ──
  useEffect(() => {
    if (!activeSessionId) {
      const session = createSession();
      setSessions([session]);
      setActiveSessionId(session.id);
      saveActiveId(session.id);
      return;
    }
    const session = sessions.find((s) => s.id === activeSessionId);
    if (session) { setMessages(session.messages); setChatName(session.name); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session) return;
    setMessages(session.messages);
    setChatName(session.name);
  }, [activeSessionId]);

  // ── Debounced sync messages → sessions ──
  useEffect(() => {
    if (!activeSessionId) return;
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
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    const timer = setTimeout(() => saveSessions(sessions), 800);
    return () => clearTimeout(timer);
  }, [sessions]);

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

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (activeDropdown === 'model' && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (activeDropdown !== 'model') setModelSearch('');
  }, [activeDropdown]);

  useEffect(() => {
    if (editingName && nameInputRef.current) { nameInputRef.current.focus(); nameInputRef.current.select(); }
  }, [editingName]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!activeDropdown) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('[data-dropdown-content]') || target.closest('[data-dropdown-trigger]')) return;
      setActiveDropdown(null);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [activeDropdown]);

  // ── Session management ──

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
    setMessages([]); setChatName('New Chat');
    saveActiveId(session.id); setSessionPanelOpen(false);
  }

  function handleDeleteSession(id: string) {
    const session = sessionsRef.current.find((s) => s.id === id);
    if (!session) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
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
        setMessages([]); setChatName('New Chat');
        saveActiveId(newSession.id);
      }
    }
  }

  // ── Send ──

  async function send(query: string) {
    if (!query.trim() || loading) return;
    abortRef.current?.abort();

    setMessages((prev) => [...prev, { role: 'user', text: query }]);
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
          context: { currentScreen, queryParam: currentScreen ? `?file=${currentScreen}` : undefined, markerContext: markerContext || undefined },
        }),
        signal: abortController.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('x-ndjson')) {
        const reader = res.body!.getReader();
        await readNdjsonStream(
          reader,
          (text) => {
            setMessages((prev) => { const next = [...prev]; const last = next[next.length - 1]; if (last?.role === 'assistant') next[next.length - 1] = { ...last, text: last.text + text, streaming: true }; return next; });
          },
          (fullText) => {
            setMessages((prev) => { const next = [...prev]; const last = next[next.length - 1]; if (last?.role === 'assistant') next[next.length - 1] = { ...last, text: fullText, streaming: false }; return next; });
            setLoading(false);
            onResetMarker?.();
          },
          (msg) => {
            setMessages((prev) => { const next = [...prev]; const last = next[next.length - 1]; if (last?.role === 'assistant') next[next.length - 1] = { ...last, text: msg, error: true, streaming: false }; return next; });
            setLoading(false);
          },
        );
      } else {
        const data = (await res.json()) as { response: string };
        setMessages((prev) => { const next = [...prev]; const last = next[next.length - 1]; if (last?.role === 'assistant') next[next.length - 1] = { ...last, text: data.response || '(empty)', streaming: false }; return next; });
        setLoading(false);
        onResetMarker?.();
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      setMessages((prev) => { const next = [...prev]; const last = next[next.length - 1]; if (last?.role === 'assistant') next[next.length - 1] = { ...last, text: 'Failed to connect to server.', error: true, streaming: false }; return next; });
      setLoading(false);
    }
  }

  function openDropdown(type: string, e: React.MouseEvent) {
    if (activeDropdown === type) { setActiveDropdown(null); return; }
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const w = DROPDOWN_WIDTHS[type] || 280;
    let left = rect.left;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    setDropdownPos({ bottom: window.innerHeight - rect.top + 4, left });
    setActiveDropdown(type);
  }

  const ApprovalIcon = getApprovalIcon(approvalMode);
  const hasMessages = messages.length > 0;

  // ── Render ──

  const emptyState = (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-tertiary opacity-50"><MessageCircle size={48} /></div>
      <div className="text-lg font-semibold text-brand-text text-center">Start a conversation</div>
      <div className="text-base text-tertiary text-center">Ask anything to get started</div>
    </div>
  );

  return (
    <div data-caid="acp/chat-panel" className="flex flex-col h-full overflow-hidden bg-[var(--brand-bg)] text-brand-text font-[-apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif]">
      {/* Header Bar */}
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
                  const id = activeSessionIdRef.current;
                  if (id) setSessions((prev) => prev.map((s) => s.id === id ? { ...s, name: e.target.value } : s));
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false); if (e.key === 'Escape') { setChatName('New Chat'); setEditingName(false); } }}
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
          <button type="button" className="flex items-center justify-center w-7 h-7 rounded-[6px] border-none bg-transparent text-tertiary cursor-pointer transition-[background] duration-150 hover:bg-primary_hover p-0" title="History" onClick={() => setSessionPanelOpen((prev) => !prev)}>
            <History size={20} />
          </button>
        </div>
      </div>

      {/* Marker Context Banner */}
      {markerContext && (
        <div className="flex items-center gap-2 px-3 py-1.5 mx-3 mt-2 rounded-lg bg-[var(--brand-accent-light)] text-brand-solid text-[13px] shrink-0">
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {markerContext.element?.caiId ? (
              <>Marked: <strong>cai-id=&ldquo;{markerContext.element.caiId}&rdquo;</strong></>
            ) : (
              <>Marked: &lt;{markerContext.element?.tag}&gt; &ldquo;{(markerContext.element?.text ?? '').substring(0, 35)}&rdquo;</>
            )}
          </span>
          {onResetMarker && (
            <button type="button" className="flex items-center justify-center w-5 h-5 border-none rounded bg-transparent text-brand-solid cursor-pointer opacity-60 transition-[opacity,background] duration-150 hover:opacity-100 hover:bg-[rgba(196,83,83,0.12)] shrink-0 p-0" onClick={onResetMarker} title="Clear marker">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* ── Messaging Component ── */}
      <Messaging
        messages={messages.map(toMessage)}
        onSend={send}
        loading={loading}
        emptyState={emptyState}
        renderMessage={(m: Message) => (
          <div className={cn(
            "max-w-[85%] px-3 py-2 rounded-[12px] text-[13px] leading-[1.5] break-words",
            m.role === 'user'
              ? "bg-[var(--brand-accent)] text-white border-b-[4px] border-b-[var(--brand-accent)] rounded-br-[4px]"
              : "bg-bg-surface text-brand-text border border-[var(--brand-border-hairline)] rounded-bl-[4px]",
            m.error && m.role === 'assistant' && "bg-[var(--brand-accent-light)] text-brand-solid border-transparent",
          )}>
            <span dangerouslySetInnerHTML={{ __html: marked.parse(m.content) as string }} />
            {m.streaming && <span className="animate-[chat-pulse_1.2s_ease-in-out_infinite] text-brand-solid opacity-70 ml-[1px]">|</span>}
          </div>
        )}
        composerPlaceholder="Ask to make changes, @mention files, run /commands"
      >
        {/* Control Bar */}
        <div className="flex justify-between items-center px-4 pb-3 gap-2">
          <div className="flex gap-1.5 flex-nowrap overflow-x-auto min-w-0">
            {/* Approval Mode */}
            <div className="relative">
              <button type="button" className="inline-flex items-center gap-1 px-2 py-[3px] rounded-[6px] border-none bg-primary_hover text-tertiary font-inherit text-[13px] font-medium cursor-pointer whitespace-nowrap transition-[background,color] duration-150 hover:bg-[var(--brand-border)] hover:text-brand-text" onClick={(e) => openDropdown('approval', e)} data-dropdown-trigger="approval">
                <ApprovalIcon size={14} /><span>{getApprovalLabel(approvalMode)}</span><ChevronDown size={12} />
              </button>
            </div>
            {/* Model Selector */}
            <div className="relative">
              <button type="button" className="inline-flex items-center gap-1 px-2 py-[3px] rounded-[6px] border-none bg-primary_hover text-tertiary font-inherit text-[13px] font-medium cursor-pointer whitespace-nowrap transition-[background,color] duration-150 hover:bg-[var(--brand-border)] hover:text-brand-text" onClick={(e) => openDropdown('model', e)} data-dropdown-trigger="model">
                <Sparkles size={14} className="text-[#fb923c]" /><span>{getModelName(model)}</span><ChevronDown size={12} />
              </button>
            </div>
            {/* Reasoning Effort */}
            <div className="relative">
              <button type="button" className="inline-flex items-center gap-1 px-2 py-[3px] rounded-[6px] border-none bg-primary_hover text-tertiary font-inherit text-[13px] font-medium cursor-pointer whitespace-nowrap transition-[background,color] duration-150 hover:bg-[var(--brand-border)] hover:text-brand-text" onClick={(e) => openDropdown('reasoning', e)} data-dropdown-trigger="reasoning">
                <BrainCircuit size={14} className="text-[#6b7280]" /><span>{getReasoningLabel(reasoningEffort)}</span><ChevronDown size={12} />
              </button>
            </div>
          </div>
          <div className="flex gap-2 items-center shrink-0">
            <button type="button" className="flex items-center justify-center w-7 h-7 rounded-[6px] border-none bg-transparent text-tertiary cursor-pointer transition-[background] duration-150 hover:bg-primary_hover p-0" title="Attach files">
              <Paperclip size={20} />
            </button>
          </div>
        </div>
      </Messaging>

      {/* ── Approval Mode Dropdown ── */}
      {activeDropdown === 'approval' && (
        <div className="fixed z-[var(--z-context-menu)] bg-bg-surface rounded-[12px] p-2 shadow-[0_8px_24px_var(--brand-shadow)] border border-[var(--brand-border)] w-[280px]" data-dropdown-content="" style={{ bottom: dropdownPos.bottom, left: dropdownPos.left }} onClick={(e) => e.stopPropagation()}>
          {APPROVAL_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" className={cn("flex items-center gap-2.5 w-full px-2.5 py-2 border-none rounded-lg bg-transparent text-brand-text font-inherit text-sm font-medium cursor-pointer text-left transition-[background] duration-150 hover:bg-primary_hover", approvalMode === opt.value && "bg-primary_hover")} onClick={() => { setApprovalMode(opt.value); setActiveDropdown(null); }}>
              <span className="shrink-0 flex items-center text-tertiary"><opt.icon size={18} /></span>
              <span className="flex-1 flex flex-col gap-0.5"><span className="text-sm font-medium text-brand-text">{opt.label}</span><span className="text-xs text-tertiary font-normal leading-[1.3]">{opt.desc}</span></span>
              {approvalMode === opt.value && <span className="shrink-0 flex items-center text-brand-solid"><Check size={16} /></span>}
            </button>
          ))}
        </div>
      )}

      {/* ── Model Selector Dropdown ── */}
      {activeDropdown === 'model' && (
        <div className="fixed z-[var(--z-context-menu)] bg-bg-surface rounded-[12px] p-2 shadow-[0_8px_24px_var(--brand-shadow)] border border-[var(--brand-border)] w-[360px]" data-dropdown-content="" style={{ bottom: dropdownPos.bottom, left: dropdownPos.left }} onClick={(e) => e.stopPropagation()}>
          <div className="px-1 pb-2 border-b border-[var(--brand-border)] mb-1">
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-tertiary pointer-events-none flex items-center"><Search size={16} /></span>
              <input ref={searchInputRef} className="w-full h-10 pl-9 pr-8 rounded-lg border border-[var(--brand-border)] bg-primary_hover text-brand-text font-inherit text-sm outline-none focus:border-[var(--brand-accent-muted)] placeholder:text-[var(--brand-muted-light)]" type="text" placeholder="Search models..." value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} />
              {modelSearch && <button type="button" className="absolute right-1.5 flex items-center justify-center w-[22px] h-[22px] border-none rounded bg-transparent text-tertiary cursor-pointer p-0 hover:bg-primary_hover" onClick={() => setModelSearch('')} tabIndex={-1}><X size={14} /></button>}
            </div>
          </div>
          {PROVIDERS.map((provider) => {
            const providerModels = MODELS.filter((m) => m.provider === provider);
            const filtered = modelSearch ? providerModels.filter((m) => m.name.toLowerCase().includes(modelSearch.toLowerCase())) : providerModels;
            if (filtered.length === 0) return null;
            return (
              <div key={provider}>
                <div className="px-2 pt-1.5 pb-0.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-brand-text">{provider}</span>
                    <span className={cn("flex items-center gap-1 text-xs text-tertiary", providerModels[0].connected && "!text-[#16a34a]", !providerModels[0].connected && "opacity-60")}>{providerModels[0].connected ? 'Connected' : 'Not connected'}<span className="flex items-center"><Key size={14} /></span></span>
                  </div>
                </div>
                {filtered.map((m) => (
                  <button key={m.id} type="button" className={cn("flex items-center gap-2.5 w-full px-2 py-1.5 border-none rounded-lg bg-transparent text-brand-text font-inherit text-sm cursor-pointer text-left transition-[background] duration-150 hover:bg-primary_hover", model === m.id && "!bg-brand-solid !text-white")} onClick={() => { setModel(m.id); setActiveDropdown(null); }} style={!m.connected ? { opacity: 0.6 } : undefined}>
                    <span className={cn("shrink-0 flex items-center", model === m.id ? "text-white" : "text-[#fb923c]")}><Sparkles size={16} /></span>
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
        <div className="fixed z-[var(--z-context-menu)] bg-bg-surface rounded-[12px] p-2 shadow-[0_8px_24px_var(--brand-shadow)] border border-[var(--brand-border)] w-[260px]" data-dropdown-content="" style={{ bottom: dropdownPos.bottom, left: dropdownPos.left }} onClick={(e) => e.stopPropagation()}>
          {REASONING_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" className={cn("flex items-center gap-2.5 w-full px-3 py-2 border-none rounded-lg bg-transparent text-brand-text font-inherit text-sm cursor-pointer text-left transition-[background] duration-150 hover:bg-primary_hover", reasoningEffort === opt.value && "bg-primary_hover")} onClick={() => { setReasoningEffort(opt.value); setActiveDropdown(null); }}>
              <span className="flex-1 flex flex-col gap-0.5"><span className="text-sm font-medium">{opt.label}</span><span className="text-xs text-tertiary font-normal leading-[1.3]">{opt.desc}</span></span>
              {reasoningEffort === opt.value && <span className="shrink-0 flex items-center text-brand-solid"><Check size={16} /></span>}
            </button>
          ))}
        </div>
      )}

      {/* ── Session Panel ── */}
      {sessionPanelOpen && (
        <SessionPanel sessions={sessions} activeId={activeSessionId} onSelect={handleSelectSession} onNew={handleNewSession} onDelete={handleDeleteSession} onClose={() => setSessionPanelOpen(false)} />
      )}
    </div>
  );
}
