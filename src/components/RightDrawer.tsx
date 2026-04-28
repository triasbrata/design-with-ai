import { useEffect, useRef } from "react";
import { Menu } from "./base/icons";

interface RightDrawerProps {
  open: boolean;
  onToggle: () => void;
}

export function RightDrawer({ open, onToggle }: RightDrawerProps) {
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
      {/* Trigger button — top-right */}
      <div className="drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle panel">
          <Menu size={18} />
        </button>
      </div>

      {/* Drawer panel — slides from right */}
      <aside ref={drawerRef} className={`right-drawer${open ? " open" : ""}`}>
        <div className="right-drawer-inner">
          <h3>Panel</h3>
          <p className="sub">Coming soon</p>
        </div>
      </aside>
    </>
  );
}
