import { useEffect, useRef, type ReactNode } from "react";
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
      <div className="cd-trigger">
        <button className="burger-btn" onClick={onToggle} type="button" aria-expanded={open} aria-label="Toggle chat">
          <MessageCircle size={18} />
        </button>
      </div>
      <aside ref={drawerRef} className={`chat-drawer${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="chat-drawer-inner">
          <div className="rd-drawer-header">
            <button
              type="button"
              className={`ld-pin-btn${pinned ? " pinned" : ""}`}
              onClick={onPinToggle}
              title={pinned ? "Switch to floating overlay" : "Pin (push mode)"}
            >
              <Pin size={14} />
            </button>
            <button type="button" className="ld-close-btn" onClick={onToggle} title="Close drawer">
              <X size={14} />
            </button>
          </div>
          {children}
        </div>
      </aside>
    </>
  );
}
