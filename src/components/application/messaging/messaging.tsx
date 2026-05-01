import { useState, useRef, useEffect, useCallback, type ReactNode, type FormEvent, type KeyboardEvent, type ComponentPropsWithRef } from "react";
import { cx } from "@/utils/cx";

/* ── Types ── */

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
  error?: boolean;
  streaming?: boolean;
}

export interface MessagingProps {
  messages: Message[];
  /** Called when user sends a message */
  onSend: (text: string) => void;
  /** Whether currently loading/streaming */
  loading?: boolean;
  /** Abort current stream */
  onAbort?: () => void;
  /** Empty state */
  emptyState?: ReactNode;
  /** Custom message renderer */
  renderMessage?: (message: Message, index: number) => ReactNode;
  /** Message bubble class override */
  messageClassName?: string;
  /** Composer props */
  composerPlaceholder?: string;
  composerDisabled?: boolean;
  /** Height */
  className?: string;
  /** Render content above composer */
  children?: ReactNode;
  /** Additional header content */
  header?: ReactNode;
}

/* ── Icons ── */

function ArrowUpIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14V2M3 7l5-5 5 5" />
    </svg>
  );
}

function MessageCircleIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/* ── Default message render ── */

function DefaultMessage({ message }: { message: Message }) {
  return (
    <div
      className={cx(
        "max-w-[85%] px-3 py-2 rounded-[12px] text-[13px] leading-[1.5] break-words",
        message.role === "user"
          ? "bg-[var(--brand-accent)] text-white border-b-[4px] border-b-[var(--brand-accent)] rounded-br-[4px]"
          : "bg-bg-surface text-brand-text border border-[var(--brand-border-hairline)] rounded-bl-[4px]",
        message.error && "bg-[var(--brand-accent-light)] text-brand-solid border-transparent",
      )}
    >
      <span>{message.content}</span>
      {message.streaming && (
        <span className="animate-pulse text-brand-solid opacity-70 ml-[1px]">|</span>
      )}
    </div>
  );
}

/* ── Component ── */

export function Messaging({
  messages,
  onSend,
  loading,
  onAbort,
  emptyState,
  renderMessage,
  messageClassName,
  composerPlaceholder = "Type a message...",
  composerDisabled,
  className,
  children,
  header,
}: MessagingProps) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasMessages = messages.length > 0;

  // Auto-scroll on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || loading) return;
      onSend(trimmed);
      setInput("");
    },
    [input, loading, onSend],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || loading) return;
        onSend(trimmed);
        setInput("");
      }
    },
    [input, loading, onSend],
  );

  const defaultEmptyState = (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-tertiary opacity-50">
        <MessageCircleIcon size={48} />
      </div>
      <div className="text-lg font-semibold text-brand-text text-center">Start a conversation</div>
      <div className="text-base text-tertiary text-center">Ask anything to get started</div>
    </div>
  );

  return (
    <div
      data-caid="application/messaging"
      className={cx("flex flex-col h-full min-h-0 overflow-hidden bg-[var(--brand-bg)] text-brand-text", className)}
    >
      {/* Header */}
      {header}

      {/* Messages area */}
      {!hasMessages ? (
        emptyState ?? defaultEmptyState
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth">
          <div ref={listRef} className="flex flex-col gap-1.5 p-3">
            {messages.map((m, i) => (
              <div
                key={m.id}
                className={cx(
                  "flex w-full animate-[chat-fade-in_0.2s_ease-out]",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {renderMessage ? renderMessage(m, i) : (
                  <div className={messageClassName}>
                    <DefaultMessage message={m} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional content (selector bars etc.) */}
      {children}

      {/* Composer */}
      <div className="relative mx-4 mb-4 px-4 py-3 rounded-[16px] bg-bg-surface border border-[var(--brand-border)] shrink-0">
        <div className="relative">
          <textarea
            ref={textareaRef}
            className="w-full text-[15px] text-brand-text bg-transparent border-none outline-none resize-none min-h-[24px] max-h-[200px] leading-[1.5] p-0 pr-20 m-0 placeholder:text-[var(--brand-muted-light)]"
            placeholder={composerPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={composerDisabled || loading}
            rows={1}
          />
        </div>

        {/* Send button */}
        <div className="absolute right-4 bottom-3 flex gap-2 items-center shrink-0">
          {loading && onAbort && (
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white cursor-pointer border-none"
              onClick={onAbort}
              title="Stop"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="2" width="10" height="10" rx="1" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-full border-none bg-brand-solid text-white cursor-pointer transition-[background,transform] duration-150 hover:bg-brand-solid_hover hover:scale-105 active:scale-95 disabled:bg-[var(--brand-accent-muted)] disabled:cursor-default disabled:scale-none p-0 shrink-0"
            onClick={handleSubmit}
            disabled={!input.trim() || loading}
            title="Send"
          >
            <ArrowUpIcon size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

Messaging.displayName = "Messaging";

/* ── Sub-components ── */

export function MessagingComposer({
  value,
  onChange,
  onSubmit,
  placeholder = "Type a message...",
  disabled,
  loading,
  className,
  children,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
} & ComponentPropsWithRef<"div">) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !loading) onSubmit();
    }
  };

  return (
    <div
      className={cx(
        "relative mx-4 mb-4 px-4 py-3 rounded-[16px] bg-bg-surface border border-[var(--brand-border)] shrink-0",
        className,
      )}
      {...props}
    >
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="w-full text-[15px] text-brand-text bg-transparent border-none outline-none resize-none min-h-[24px] max-h-[200px] leading-[1.5] p-0 pr-20 m-0 placeholder:text-[var(--brand-muted-light)]"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          rows={1}
        />
      </div>
      <div className="absolute right-4 bottom-3 flex gap-2 items-center shrink-0">
        {children}
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-full border-none bg-brand-solid text-white cursor-pointer transition-[background,transform] duration-150 hover:bg-brand-solid_hover hover:scale-105 active:scale-95 disabled:bg-[var(--brand-accent-muted)] disabled:cursor-default disabled:scale-none p-0 shrink-0"
          onClick={onSubmit}
          disabled={!value.trim() || loading}
          title="Send"
        >
          <ArrowUpIcon size={18} />
        </button>
      </div>
    </div>
  );
}
MessagingComposer.displayName = "MessagingComposer";

export function MessagingToolbar({ className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cx("flex justify-between items-center mt-2 gap-2 px-1", className)}
      {...props}
    />
  );
}
MessagingToolbar.displayName = "MessagingToolbar";

export function MessagingDropdown({
  icon,
  label,
  items,
  activeId,
  onSelect,
  className,
}: {
  icon?: ReactNode;
  label?: string;
  items: { id: string; label: string; desc?: string; icon?: ReactNode }[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={cx(
          "inline-flex items-center gap-1 px-2 py-[3px] rounded-[6px] border-none bg-primary_hover text-tertiary font-inherit text-[13px] font-medium cursor-pointer whitespace-nowrap transition-[background,color] duration-150 hover:bg-[var(--brand-border)] hover:text-brand-text",
          className,
        )}
        onClick={() => setOpen(!open)}
      >
        {icon}
        <span>{label ?? items.find((i) => i.id === activeId)?.label ?? activeId}</span>
        <ChevronDownIcon size={12} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50 bg-bg-surface rounded-[12px] p-2 shadow-[0_8px_24px_var(--brand-shadow)] border border-[var(--brand-border)] w-[280px]">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx(
                "flex items-center gap-2.5 w-full px-3 py-2 border-none rounded-lg bg-transparent text-brand-text font-inherit text-sm cursor-pointer text-left transition-[background] duration-150 hover:bg-primary_hover",
                activeId === item.id && "bg-primary_hover",
              )}
              onClick={() => {
                onSelect(item.id);
                setOpen(false);
              }}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="flex-1 flex flex-col gap-0.5">
                <span className="text-sm font-medium">{item.label}</span>
                {item.desc && <span className="text-xs text-tertiary font-normal">{item.desc}</span>}
              </span>
              {activeId === item.id && <CheckIcon size={16} className="text-brand-solid" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
MessagingDropdown.displayName = "MessagingDropdown";

/* ── Internal icons ── */

function ChevronDownIcon({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function CheckIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 8l3.5 3.5L13 4" />
    </svg>
  );
}
