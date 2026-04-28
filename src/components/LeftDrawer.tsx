import { useEffect, useRef, useState, useMemo } from "react";
import { Menu, Plus, ChevronDown, ChevronRight, Folder, FolderOpen } from "./base/icons";
import { screenName, TIERS } from "../constants";
import type { Project } from "../types";

interface LeftDrawerProps {
  open: boolean;
  onToggle: () => void;
  projects: Project[];
  activeIndex: number;
  activeFolderIdx: number;
  screens: string[];
  activeScreen: string;
  onSelect: (screen: string) => void;
  onSetActive: (index: number, folderIdx?: number) => void;
  onAddWorkspace?: () => void;
}

export function LeftDrawer({
  open,
  onToggle,
  projects,
  activeIndex,
  activeFolderIdx,
  screens,
  activeScreen,
  onSelect,
  onSetActive,
  onAddWorkspace,
}: LeftDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([activeIndex]));

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

  // Auto-expand active workspace when drawer opens
  useEffect(() => {
    if (open) {
      setExpanded((prev) => new Set(prev).add(activeIndex));
    }
  }, [open, activeIndex]);

  const existing = useMemo(() => new Set(screens), [screens]);

  function toggle(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <>
      <div className="left-drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle workspace">
          <Menu size={18} />
        </button>
      </div>
      <aside ref={drawerRef} className={`left-drawer${open ? " open" : ""}`}>
        <div className="left-drawer-inner">
          {onAddWorkspace && (
            <button className="ld-add-workspace" onClick={onAddWorkspace}>
              <Plus size={14} />
              Add Workspace
            </button>
          )}
          {projects.map((project, pi) => {
            const isActiveWs = pi === activeIndex;
            const isExpanded = expanded.has(pi);

            if (project.type === "workspace") {
              return (
                <div className="ld-section" key={`ws-${pi}`}>
                  <button
                    className="ld-section-header"
                    onClick={() => toggle(pi)}
                    style={isActiveWs ? { fontWeight: 600 } : undefined}
                  >
                    <span className="ld-chevron">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <Folder size={14} />
                    <span className="ld-section-title">{project.name}</span>
                  </button>
                  {isExpanded && (
                    <div className="ld-section-body">
                      {project.folders.map((folder, fi) => {
                        const isActiveFolder = isActiveWs && fi === activeFolderIdx;
                        return (
                          <div key={`f-${fi}`} style={{ paddingLeft: 4 }}>
                            <button
                              className="ld-section-header"
                              onClick={() => {
                                if (!isActiveFolder) onSetActive(pi, fi);
                              }}
                              style={{ fontSize: 13, fontWeight: isActiveFolder ? 600 : 400 }}
                            >
                              <span className="ld-chevron">
                                {isActiveFolder ? (
                                  <ChevronDown size={12} />
                                ) : (
                                  <ChevronRight size={12} />
                                )}
                              </span>
                              <Folder size={12} />
                              <span className="ld-section-title">{folder.name}</span>
                            </button>
                            {isActiveFolder && (
                              <div style={{ paddingLeft: 8 }}>
                                {Object.entries(TIERS).map(([tier, info]) => {
                                  const tierScreens = info.screens.filter((s) =>
                                    existing.has(s),
                                  );
                                  if (!tierScreens.length) return null;
                                  return (
                                    <div className="ld-tier-group" key={tier}>
                                      <div className="ld-tier-label">
                                        {tier} — {info.label}
                                      </div>
                                      {tierScreens.map((s) => (
                                        <button
                                          key={s}
                                          className={`ld-screen-item${s === activeScreen ? " active" : ""}`}
                                          onClick={() => {
                                            onSelect(s);
                                            onToggle();
                                          }}
                                          title={screenName(s)}
                                        >
                                          {screenName(s)}
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })}
                                {existing.size === 0 && (
                                  <div className="ld-loading" style={{ padding: 12 }}>
                                    <span style={{ color: "var(--brand-muted)", fontSize: 12 }}>
                                      No screens found
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Client project — no folder level
            return (
              <div className="ld-section" key={`client-${pi}`}>
                <button
                  className="ld-section-header"
                  onClick={() => {
                    if (!isActiveWs) onSetActive(pi);
                    toggle(pi);
                  }}
                  style={isActiveWs ? { fontWeight: 600 } : undefined}
                >
                  <span className="ld-chevron">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <FolderOpen size={14} />
                  <span className="ld-section-title">{project.name}</span>
                </button>
                {isExpanded && (
                  <div className="ld-section-body" style={{ paddingLeft: 4 }}>
                    {Object.entries(TIERS).map(([tier, info]) => {
                      const tierScreens = info.screens.filter((s) => existing.has(s));
                      if (!tierScreens.length) return null;
                      return (
                        <div className="ld-tier-group" key={tier}>
                          <div className="ld-tier-label">
                            {tier} — {info.label}
                          </div>
                          {tierScreens.map((s) => (
                            <button
                              key={s}
                              className={`ld-screen-item${s === activeScreen ? " active" : ""}`}
                              onClick={() => {
                                onSelect(s);
                                onToggle();
                              }}
                              title={screenName(s)}
                            >
                              {screenName(s)}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                    {existing.size === 0 && (
                      <div style={{ padding: 12, color: "var(--brand-muted)", fontSize: 12 }}>
                        No screens loaded
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
