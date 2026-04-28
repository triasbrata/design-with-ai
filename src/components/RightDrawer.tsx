import { useEffect, useRef, type ReactNode } from 'react';

interface RightDrawerProps {
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

export function RightDrawer({ open, onToggle, children }: RightDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onToggle]);

  return (
    <>
      {/* Trigger button — top-right */}
      <div className="drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle panel">
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Drawer panel — slides from right */}
      <aside ref={drawerRef} className={`right-drawer${open ? ' open' : ''}`}>
        <div className="right-drawer-inner">
          <div style={{ marginBottom: 8 }}>
            <span className="name" style={{ fontSize: 12 }}>Design Review</span>
          </div>
          {children}
        </div>
      </aside>
    </>
  );
}
