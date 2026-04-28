import { useEffect, useRef, useState, useMemo } from "react";
import { Menu, CheckCircle2, Loader2, ChevronDown, ChevronRight, Folder } from "./base/icons";
import { screenName, TIERS } from "../constants";
import type { Metadata } from "../types";

interface LeftDrawerProps {
  open: boolean;
  onToggle: () => void;
  metadata: Metadata | null;
  screens: string[];
  activeScreen: string;
  onSelect: (screen: string) => void;
  projectName: string;
}

export function LeftDrawer({ open, onToggle, metadata, screens, activeScreen, onSelect, projectName }: LeftDrawerProps) {
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

  const workspace = useMemo(() => {
    if (!metadata) return null;
    const existing = new Set(Object.keys(metadata.screens));
    const tierBreakdown = Object.entries(TIERS).map(([tier, info]) => {
      const count = info.screens.filter((s) => existing.has(s)).length;
      return { tier, label: info.label, count };
    });
    const totalInTiers = tierBreakdown.reduce((s, t) => s + t.count, 0);
    const unlisted = existing.size - totalInTiers;
    return {
      version: metadata.meta.version,
      lastUpdated: metadata.meta.lastUpdated,
      totalScreens: metadata.meta.totalScreens,
      components: Object.keys(metadata.components).length,
      tierBreakdown,
      unlisted,
    };
  }, [metadata]);

  const existing = useMemo(() => new Set(screens), [screens]);

  return (
    <>
      <div className="left-drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle workspace">
          <Menu size={18} />
        </button>
      </div>
      <aside ref={drawerRef} className={`left-drawer${open ? " open" : ""}`}>
        <div className="left-drawer-inner">
          {/* Workspace section (collapsible) */}
          <div className="ld-section">
            <button className="ld-section-header" onClick={() => setWsOpen((p) => !p)}>
              <span className="ld-chevron">{wsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
              <Folder size={14} />
              <span className="ld-section-title">Workspace</span>
            </button>
            {wsOpen && (
              <div className="ld-section-body">
                {workspace ? (
                  <>
                    <div className="ld-project-name">{projectName || "Workspace"}</div>
                    <div className="ld-meta-row">
                      <span className="ld-meta-label">Version</span>
                      <span className="ld-meta-value">{workspace.version}</span>
                    </div>
                    <div className="ld-meta-row">
                      <span className="ld-meta-label">Last Updated</span>
                      <span className="ld-meta-value">{workspace.lastUpdated}</span>
                    </div>
                    <div className="ld-meta-row">
                      <span className="ld-meta-label">Screens</span>
                      <span className="ld-meta-value">{workspace.totalScreens}</span>
                    </div>
                    {workspace.tierBreakdown.map((t) =>
                      t.count > 0 ? (
                        <div className="ws-tier" key={t.tier}>
                          <span className="ws-tier-label">{t.tier}</span>
                          <span className="ws-tier-bar">
                            <span className="ws-tier-fill" style={{ width: `${(t.count / workspace.totalScreens) * 100}%` }} />
                          </span>
                          <span className="ws-tier-count">{t.count}</span>
                        </div>
                      ) : null
                    )}
                    {workspace.unlisted > 0 && (
                      <div className="ws-tier">
                        <span className="ws-tier-label">Other</span>
                        <span className="ws-tier-count">{workspace.unlisted}</span>
                      </div>
                    )}
                    <div className="ld-meta-row">
                      <span className="ld-meta-label">Components</span>
                      <span className="ld-meta-value">{workspace.components}</span>
                    </div>
                    <div className="ld-status">
                      <CheckCircle2 size={14} />
                      <span>Workspace ready</span>
                    </div>
                  </>
                ) : (
                  <div className="ld-loading">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Screens section (collapsible, tier-organized) */}
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
        </div>
      </aside>
    </>
  );
}
