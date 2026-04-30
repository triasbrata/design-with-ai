import { useEffect, useRef, type ReactNode } from "react";
import { MessageCircle, X } from "./base/icons";

interface RightDrawerProps {
  open: boolean;
  onToggle: () => void;
  pinned: boolean;
  onPinToggle: () => void;
  children?: ReactNode;
  markers?: { id: string; color: string; text: string; elementPath: string[]; screen: string }[];
  onRemoveMarker?: (id: string) => void;
}

export function RightDrawer({ open, onToggle, pinned, onPinToggle, children, markers, onRemoveMarker }: RightDrawerProps) {
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
    <div data-caid="right-drawer">
      <div className="drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle chat">
          <MessageCircle size={18} />
        </button>
      </div>
      <aside ref={drawerRef} className={open ? `right-drawer${pinned ? " push" : " floating"} open` : "right-drawer"}>
        <div className="right-drawer-inner">
          <div className="rd-drawer-header">
            <button className="ld-close-btn" onClick={onToggle} title="Close drawer">
              <X size={14} />
            </button>
          </div>
          {/* Marker chips */}
          {markers && markers.length > 0 && (
            <div className="marker-chips">
              {markers.map((m) => (
                <div key={m.id} className="marker-chip">
                  <span className="marker-chip-dot" style={{ background: m.color }} />
                  <span className="marker-chip-text">{m.text.slice(0, 30)}</span>
                  <span className="marker-chip-path">{m.elementPath[0] || ""}</span>
                  <button
                    className="marker-chip-remove"
                    onClick={() => onRemoveMarker?.(m.id)}
                    aria-label="Remove marker"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {children}
        </div>
      </aside>
    </div>
  );
}
