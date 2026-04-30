import { useState, useEffect, useRef } from 'react';
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
    <div className="sp-panel" ref={panelRef}>
      {/* Header */}
      <div className="sp-header">
        <Monitor size={16} />
        <span>Local</span>
      </div>

      {/* Search */}
      <div className="sp-search">
        <span className="sp-search-icon">
          <Search size={14} />
        </span>
        <input
          ref={searchRef}
          className="sp-search-input"
          type="text"
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Session list */}
      <div className="sp-list">
        {!hasSessions ? (
          <div className="sp-empty">No sessions yet</div>
        ) : (
          filtered.map((session) => (
            <div
              key={session.id}
              className={`sp-item${session.id === activeId ? ' selected' : ''}`}
            >
              <span
                className="sp-item-name"
                onClick={() => onSelect(session.id)}
              >
                {session.name}
              </span>
              <div className="sp-item-right">
                <span className="sp-item-time">
                  {formatTime(session.updatedAt)}
                </span>
                {session.id === activeId && (
                  <span className="sp-item-check">
                    <Check size={14} />
                  </span>
                )}
                <button
                  type="button"
                  className="sp-item-delete"
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
      <button type="button" className="sp-new-btn" onClick={onNew}>
        <Plus size={16} />
        <span>New Chat</span>
      </button>
    </div>
  );
}
