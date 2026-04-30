import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { MessageCircle, X, Pin } from "./base/icons";

interface ChatDrawerProps {
  open: boolean;
  onToggle: () => void;
  pinned: boolean;
  onPinToggle: () => void;
  children: ReactNode;
}

export function ChatDrawer({ open, onToggle, pinned, onPinToggle, children }: ChatDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || pinned) return;
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onToggle, pinned]);

  return (
    <>
      <div className="fixed top-3 right-3 z-[var(--z-drawer-trigger)]">
        <button className="w-8 h-8 rounded-lg border border-[var(--brand-border-hairline)] bg-[var(--brand-surface)] cursor-pointer flex items-center justify-center gap-[3px] shrink-0 p-0" onClick={onToggle} type="button" aria-expanded={open} aria-label="Toggle chat">
          <MessageCircle size={18} />
        </button>
      </div>
      <aside
        ref={drawerRef}
        className={cn(
          "fixed top-0 right-0 z-[var(--z-drawer)] h-screen overflow-y-auto overflow-x-hidden bg-bg-surface border-l border-transparent transition-[width] duration-[250ms] ease-linear invisible pointer-events-none",
          open && "visible pointer-events-auto border-[var(--brand-border)]"
        )}
        style={{ width: open ? 'var(--sidebar-width)' : 0 }}
        aria-hidden={!open}
      >
        <div className="w-[var(--sidebar-width)] h-full flex flex-col p-4">
          <div className="flex justify-end px-3 pt-2 pb-1">
            <button
              type="button"
              className={cn(
                "flex items-center justify-center p-1 border-none rounded-[6px] bg-transparent text-tertiary cursor-pointer transition-[background,color] duration-150 hover:bg-primary_hover hover:text-brand-text",
                pinned && "text-brand-solid bg-primary_hover"
              )}
              onClick={onPinToggle}
              title={pinned ? "Switch to floating overlay" : "Pin (push mode)"}
            >
              <Pin size={14} />
            </button>
            <button type="button" className="flex items-center justify-center p-1 border-none rounded-[6px] bg-transparent text-tertiary cursor-pointer transition-[background,color] duration-150 hover:bg-[var(--brand-accent-light)] hover:text-brand-solid" onClick={onToggle} title="Close drawer">
              <X size={14} />
            </button>
          </div>
          {children}
        </div>
      </aside>
    </>
  );
}
