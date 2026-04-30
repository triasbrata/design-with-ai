import { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/cn';
import { Monitor, Search, Plus, Check, Trash2 } from '../components/base/icons';
import type { ChatSession } from './sessions';
import { formatTime } from './sessions';

interface SessionPanelProps {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function SessionPanel({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: SessionPanelProps) {
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-focus search on mount
  useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const filtered = search.trim()
    ? sessions.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase().trim()),
      )
    : sessions;

  const hasSessions = filtered.length > 0;

  return (
    <div className="fixed right-4 top-14 w-[380px] max-h-[520px] rounded-[14px] bg-bg-surface border border-brand-border shadow-[0_8px_32px_var(--brand-shadow)] z-[var(--z-context-menu)] p-4 overflow-hidden flex flex-col" ref={panelRef}>
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-semibold pb-3 text-brand-text shrink-0">
        <Monitor size={16} />
        <span>Local</span>
      </div>

      {/* Search */}
      <div className="relative mb-2 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none flex items-center">
          <Search size={14} />
        </span>
        <input
          ref={searchRef}
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-[var(--brand-border-hairline)] bg-[var(--brand-bg)] text-brand-text font-inherit text-[13px] outline-none transition-[border-color] duration-150 focus:border-[var(--brand-accent-muted)] placeholder:text-[var(--brand-muted-light)]"
          type="text"
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto min-h-0 mx-[-4px]">
        {!hasSessions ? (
          <div className="flex items-center justify-center p-6 text-tertiary text-[13px]">No sessions yet</div>
        ) : (
          filtered.map((session) => (
            <div
              key={session.id}
              className={cn(
                "flex items-center justify-between h-11 px-3 rounded-lg cursor-pointer transition-[background] duration-150 mx-1 hover:bg-primary_hover group",
                session.id === activeId && "bg-[var(--brand-accent-light)] font-semibold"
              )}
            >
              <span
                className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] cursor-pointer"
                onClick={() => onSelect(session.id)}
              >
                {session.name}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-tertiary whitespace-nowrap">
                  {formatTime(session.updatedAt)}
                </span>
                {session.id === activeId && (
                  <span className="flex items-center text-brand-solid">
                    <Check size={14} />
                  </span>
                )}
                <button
                  type="button"
                  className="flex items-center justify-center w-[22px] h-[22px] border-none rounded bg-transparent text-[var(--brand-muted-light)] cursor-pointer p-0 opacity-0 transition-[opacity,background,color] duration-150 shrink-0 group-hover:opacity-100 hover:!bg-[var(--brand-accent-light)] hover:!text-brand-solid"
                  title="Delete session"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(session.id);
                  }}
                  tabIndex={-1}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Chat button */}
      <button type="button" className="flex items-center justify-center gap-1.5 w-full mt-2 p-2 border border-dashed border-brand-border rounded-lg bg-transparent text-tertiary font-inherit text-[13px] font-semibold cursor-pointer transition-all duration-150 shrink-0 hover:bg-primary_hover hover:text-brand-text hover:border-[var(--brand-muted-light)]" onClick={onNew}>
        <Plus size={16} />
        <span>New Chat</span>
      </button>
    </div>
  );
}
