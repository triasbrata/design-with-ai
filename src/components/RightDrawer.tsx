import { useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import { MessageCircle, X, Pin, ChevronDown, ChevronRight, Folder } from "./base/icons";
import { screenName, TIERS } from "../constants";
import type { Metadata } from "../types";

export type RightDrawerTab = "workspace" | "chat";

interface RightDrawerProps {
  open: boolean;
  onToggle: () => void;
  pinned: boolean;
  onPinToggle: () => void;
  children?: ReactNode;
  screens?: string[];
  activeScreen?: string;
  metadata?: Metadata | null;
  onSelect?: (screen: string) => void;
  projectName?: string;
  activeTab?: RightDrawerTab;
  onTabChange?: (tab: RightDrawerTab) => void;
}

export function RightDrawer({
  open,
  onToggle,
  pinned,
  onPinToggle,
  children,
  screens = [],
  activeScreen = "",
  metadata = null,
  onSelect,
  projectName = "",
  activeTab = "workspace",
  onTabChange,
}: RightDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [wsOpen, setWsOpen] = useState(true);
  const [screensOpen, setScreensOpen] = useState(true);

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
      setWsOpen(true);
      setScreensOpen(true);
    }
  }, [open]);

  const existing = useMemo(() => new Set(screens), [screens]);

  return (
    <>
      <div className="drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle chat">
          <MessageCircle size={18} />
        </button>
      </div>
      <aside ref={drawerRef} className={open ? `right-drawer${pinned ? " push" : " floating"} open` : "right-drawer"}>
        <div className="right-drawer-inner">
          {/* Header with pin and close */}
          <div className="rd-drawer-header">
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

          {/* Tab bar */}
          <div className="rd-tab-bar" style={{ margin: "0 12px 12px" }}>
            <button
              className={`rd-tab${activeTab === "workspace" ? " active" : ""}`}
              onClick={() => onTabChange?.("workspace")}
            >
              Workspace
            </button>
            <button
              className={`rd-tab${activeTab === "chat" ? " active" : ""}`}
              onClick={() => onTabChange?.("chat")}
            >
              Chat
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "workspace" ? (
            <>
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
                              onClick={() => { onSelect?.(s); onToggle(); }}
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
            </>
          ) : (
            children || (
              <div className="rd-chat-placeholder">
                <p>AI Chat panel — coming soon</p>
              </div>
            )
          )}
        </div>
      </aside>
    </>
  );
}
