import type { ReactNode } from "react";
import { SlideoutMenu } from "./application/slideout-menus/slideout-menu";
import { MessageCircle } from "./base/icons";

interface RightDrawerProps {
  open: boolean;
  onToggle: () => void;
  pinned: boolean;
  onPinToggle: () => void;
  children?: ReactNode;
  markers?: { id: string; color: string; text: string; elementPath: string[]; screen: string }[];
  onRemoveMarker?: (id: string) => void;
}

export function RightDrawer({ open, onToggle, pinned: _pinned, onPinToggle: _onPinToggle, children, markers, onRemoveMarker }: RightDrawerProps) {
  return (
    <>
      {/* Trigger button */}
      <div className="drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle chat panel">
          <MessageCircle size={18} />
        </button>
      </div>

      {/* Slideout panel */}
      <SlideoutMenu
        isOpen={open}
        onOpenChange={(isOpen) => { if (!isOpen) onToggle(); }}
        className="[&_[role=dialog]]:!w-[380px]"
      >
        {/* Marker chips */}
        {markers && markers.length > 0 && (
          <div className="marker-chips flex flex-wrap gap-1.5 px-3 py-2 border-b border-[var(--brand-border)]">
            {markers.map((m) => (
              <div key={m.id} className="marker-chip inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary_hover text-xs">
                <span className="marker-chip-dot size-2 rounded-full shrink-0" style={{ background: m.color }} />
                <span className="marker-chip-text max-w-[120px] truncate">{m.text.slice(0, 30)}</span>
                <span className="marker-chip-path text-tertiary text-[10px]">{m.elementPath[0] || ""}</span>
                <button
                  className="marker-chip-remove flex items-center justify-center size-4 rounded-full border-none bg-transparent text-tertiary cursor-pointer hover:bg-black/10"
                  onClick={() => onRemoveMarker?.(m.id)}
                  aria-label="Remove marker"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 1l6 6M7 1l-6 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        {children}
      </SlideoutMenu>
    </>
  );
}
