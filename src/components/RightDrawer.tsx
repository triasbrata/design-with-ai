import { useState, useMemo, useRef, useEffect } from "react";
import { Menu, ChevronDown, ChevronRight, Folder } from "./base/icons";
import { screenName, TIERS } from "../constants";
import type { Metadata } from "../types";

interface RightDrawerProps {
  open: boolean;
  onToggle: () => void;
  screens: string[];
  activeScreen: string;
  metadata: Metadata | null;
  onSelect: (screen: string) => void;
  projectName: string;
}

export function RightDrawer({ open, onToggle, screens, activeScreen, metadata, onSelect, projectName }: RightDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [wsOpen, setWsOpen] = useState(true);
  const [screensOpen, setScreensOpen] = useState(true);

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

  useEffect(() => {
    if (open) {
      setWsOpen(true);
      setScreensOpen(true);
    }
  }, [open]);

  const existing = useMemo(() => new Set(screens), [screens]);

  return (
    <>
      <div className="drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle panel">
          <Menu size={18} />
        </button>
      </div>
      <aside ref={drawerRef} className={`right-drawer${open ? " open" : ""}`}>
        <div className="right-drawer-inner">
          {/* Workspace section */}
          <div className="rd-section">
            <button className="rd-section-header" onClick={() => setWsOpen((p) => !p)}>
              <span className="rd-chevron">{wsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
              <Folder size={14} />
              <span className="rd-section-title">Workspace</span>
            </button>
            {wsOpen && (
              <div className="rd-section-body">
                <div className="rd-project-name">{projectName || "No project"}</div>
                {metadata && (
                  <>
                    <div className="rd-meta-row">
                      <span className="rd-meta-label">Version</span>
                      <span className="rd-meta-value">{metadata.meta.version}</span>
                    </div>
                    <div className="rd-meta-row">
                      <span className="rd-meta-label">Last Updated</span>
                      <span className="rd-meta-value">{metadata.meta.lastUpdated}</span>
                    </div>
                    <div className="rd-meta-row">
                      <span className="rd-meta-label">Screens</span>
                      <span className="rd-meta-value">{metadata.meta.totalScreens}</span>
                    </div>
                    <div className="rd-meta-row">
                      <span className="rd-meta-label">Components</span>
                      <span className="rd-meta-value">{Object.keys(metadata.components).length}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Screens section */}
          <div className="rd-section">
            <button className="rd-section-header" onClick={() => setScreensOpen((p) => !p)}>
              <span className="rd-chevron">{screensOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
              <Folder size={14} />
              <span className="rd-section-title">Screens</span>
              <span className="rd-section-count">{screens.length}</span>
            </button>
            {screensOpen && (
              <div className="rd-section-body">
                {Object.entries(TIERS).map(([tier, info]) => {
                  const tierScreens = info.screens.filter((s) => existing.has(s));
                  if (!tierScreens.length) return null;
                  return (
                    <div className="rd-tier-group" key={tier}>
                      <div className="rd-tier-label">{tier} &mdash; {info.label}</div>
                      {tierScreens.map((s) => (
                        <button
                          key={s}
                          className={`rd-screen-item${s === activeScreen ? " active" : ""}`}
                          onClick={() => { onSelect(s); onToggle(); }}
                          title={screenName(s)}
                        >
                          {screenName(s)}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
