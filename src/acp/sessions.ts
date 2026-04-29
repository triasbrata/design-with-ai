/**
 * ChatSession data model + localStorage persistence.
 *
 * Messages are stored WITHOUT the transient `streaming` flag — that field
 * is only used at runtime inside ChatPanel.
 */

export interface ChatSession {
  id: string;
  name: string;
  messages: { role: 'user' | 'assistant'; text: string; error?: boolean }[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'golden-review.chat-sessions.v1';
const ACTIVE_KEY = 'golden-review.active-session.v1';
const MAX_SESSIONS = 50;

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]): void {
  try {
    const trimmed = sessions.slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function loadActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
    // ignore
  }
}

export function createSession(name?: string): ChatSession {
  return {
    id: crypto.randomUUID(),
    name: name || 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Simple relative-time formatter for session timestamps.
 */
export function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
