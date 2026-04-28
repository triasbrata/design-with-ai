import { useEffect, useRef, useState, useMemo } from "react";
import { PanelLeft, Pin, X, ChevronDown, ChevronRight, Folder } from "./base/icons";
import { screenName, TIERS } from "../constants";
import type { Metadata } from "../types";

interface LeftDrawerProps {
  open: boolean;
  onToggle: () => void;
  pinned: boolean;
  onPinToggle: () => void;
  screens: string[];
  activeScreen: string;
  metadata: Metadata | null;
  onSelect: (screen: string) => void;
  projectName: string;
}

export function LeftDrawer({
  open,
  onToggle,
  pinned,
  onPinToggle,
  screens,
  activeScreen,
  metadata,
  onSelect,
  projectName,
}: LeftDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [projectOpen, setProjectOpen] = useState(true);
  const [screensOpen, setScreensOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  useEffect(() => {
    if (open) {
      setProjectOpen(true);
      setScreensOpen(true);
    }
  }, [open]);

  const existing = useMemo(() => new Set(screens), [screens]);

  return (
    <>
      <div className="ld-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle workspace">
          <PanelLeft size={18} />
        </button>
      </div>
      <aside ref={drawerRef} className={open ? `left-drawer${pinned ? " push" : " floating"} open` : "left-drawer"}>
        <div className="left-drawer-inner">
          <div className="ld-drawer-header">
            <button
              className={`ld-pin-btn${pinned ? " pinned" : ""}`}
              onClick={onPinToggle}
              title={pinned ? "Switch to floating overlay" : "Pin (push mode)"}
            >
              <Pin size={14} />
            </button>
            <button className="ld-close-btn" onClick={onToggle} title="Close drawer">
              <X size={14} />
            </button>
          </div>

          {/* Project section */}
          <div className="ld-section">
            <button className="ld-section-header" onClick={() => setProjectOpen((p) => !p)}>
              <span className="ld-chevron">{projectOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
              <Folder size={14} />
              <span className="ld-section-title">Project</span>
            </button>
            {projectOpen && (
              <div className="ld-section-body">
                <div className="ld-project-name">{projectName || "No project"}</div>
              </div>
            )}
          </div>

          {/* Screens section */}
          <div className="ld-section">
            <button className="ld-section-header" onClick={() => setScreensOpen((p) => !p)}>
              <span className="ld-chevron">{screensOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
              <Folder size={14} />
              <span className="ld-section-title">Screens</span>
              <span className="ld-section-count">{screens.length}</span>
            </button>
            {screensOpen && (
              <div className="ld-section-body">
                {Object.entries(TIERS).map(([tier, info]) => {
                  const tierScreens = info.screens.filter((s) => existing.has(s));
                  if (!tierScreens.length) return null;
                  return (
                    <div className="ld-tier-group" key={tier}>
                      <div className="ld-tier-label">{tier} &mdash; {info.label}</div>
                      {tierScreens.map((s) => (
                        <button
                          key={s}
                          className={`ld-screen-item${s === activeScreen ? " active" : ""}`}
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

          {/* Details section */}
          <div className="ld-section">
            <button className="ld-section-header" onClick={() => setDetailsOpen((p) => !p)}>
              <span className="ld-chevron">{detailsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
              <Folder size={14} />
              <span className="ld-section-title">Details</span>
            </button>
            {detailsOpen && metadata && (
              <div className="ld-section-body">
                <div className="ld-meta-row">
                  <span className="ld-meta-label">Version</span>
                  <span className="ld-meta-value">{metadata.meta.version}</span>
                </div>
                <div className="ld-meta-row">
                  <span className="ld-meta-label">Last Updated</span>
                  <span className="ld-meta-value">{metadata.meta.lastUpdated}</span>
                </div>
                <div className="ld-meta-row">
                  <span className="ld-meta-label">Screens</span>
                  <span className="ld-meta-value">{metadata.meta.totalScreens}</span>
                </div>
                <div className="ld-meta-row">
                  <span className="ld-meta-label">Components</span>
                  <span className="ld-meta-value">{Object.keys(metadata.components).length}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
