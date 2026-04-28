import { useEffect, useRef, type ReactNode } from "react";
import { MessageCircle, Pin } from "./base/icons";

interface RightDrawerProps {
  open: boolean;
  onToggle: () => void;
  pinned: boolean;
  onPinToggle: () => void;
  children?: ReactNode;
}

export function RightDrawer({ open, onToggle, pinned, onPinToggle, children }: RightDrawerProps) {
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
      <div className="drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle chat">
          <MessageCircle size={18} />
        </button>
      </div>
      <aside ref={drawerRef} className={open ? `right-drawer${pinned ? " push" : " floating"} open` : "right-drawer"}>
        <div className="right-drawer-inner">
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="name" style={{ fontSize: 12 }}>Design Review</span>
            <button
              className={`ld-pin-btn${pinned ? " pinned" : ""}`}
              onClick={onPinToggle}
              title={pinned ? "Switch to floating overlay" : "Pin (push mode)"}
            >
              <Pin size={14} />
            </button>
          </div>
          {children}
        </div>
      </aside>
    </>
  );
}
