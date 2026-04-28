import { useEffect, useRef, type ReactNode } from "react";
import { Menu } from "./base/icons";

interface RightDrawerProps {
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
  markers?: { id: string; color: string; text: string; elementPath: string[]; screen: string }[];
  onRemoveMarker?: (id: string) => void;
}

export function RightDrawer({ open, onToggle, children, markers, onRemoveMarker }: RightDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onToggle]);

  return (
    <>
      <div className="drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle panel">
          <Menu size={18} />
        </button>
      </div>
      <aside ref={drawerRef} className={`right-drawer${open ? " open" : ""}`}>
        <div className="right-drawer-inner">
          <div style={{ marginBottom: 8 }}>
            <span className="name" style={{ fontSize: 12 }}>Design Review</span>
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
    </>
  );
}
