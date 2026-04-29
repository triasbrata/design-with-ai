import { useEffect, useRef, useState, useMemo } from "react";
import { PanelLeft, Pin, X, ChevronDown, ChevronRight, Folder } from "./base/icons";
import { screenName, TIERS } from "../constants";
import type { Metadata, Project } from "../types";

interface LeftDrawerProps {
  open: boolean;
  onToggle: () => void;
  pinned: boolean;
  onPinToggle: () => void;
  projects: Project[];
  activeIndex: number;
  onSelectWorkspace: (idx: number, folderIdx?: number) => void;
  screens: string[];
  activeScreen: string;
  onSelectScreen: (screen: string) => void;
  metadata: Metadata | null;
}

export function LeftDrawer({
  open,
  onToggle,
  pinned,
  onPinToggle,
  projects,
  activeIndex,
  onSelectWorkspace,
  screens,
  activeScreen,
  onSelectScreen,
  metadata,
}: LeftDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  /** Track expanded/collapsed tree nodes: "w:{idx}" = workspace, "f:{wsIdx}-{fi}" = folder */
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());

  const isOpen = (key: string) => openNodes.has(key);
  const toggleNode = (key: string) => {
    setOpenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  // Reset tree on open: expand active workspace + active folder
  useEffect(() => {
    if (open) {
      const next = new Set<string>();
      next.add(`w:${activeIndex}`);
      const project = projects[activeIndex];
      if (project?.type === "workspace") {
        next.add(`f:${activeIndex}-${project.activeFolder}`);
      }
      setOpenNodes(next);
    }
  }, [open, activeIndex, projects]);

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

          {projects.map((project, idx) => {
            if (project.type === "client") {
              // Client projects: inline list item
              const isActive = idx === activeIndex;
              return (
                <button
                  key={idx}
                  className={`ld-workspace-header${isActive ? " active" : ""}`}
                  onClick={() => onSelectWorkspace(idx)}
                >
                  <Folder size={14} />
                  <span className="ld-ws-name">{project.name}</span>
                </button>
              );
            }

            const wsKey = `w:${idx}`;
            const wsExpanded = isOpen(wsKey);

            return (
              <div className="ld-workspace-group" key={idx}>
                <button
                  className="ld-workspace-header"
                  onClick={() => toggleNode(wsKey)}
                >
                  <span className="ld-chevron">
                    {wsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <Folder size={14} />
                  <span className="ld-ws-name">{project.name}</span>
                </button>

                {wsExpanded && (
                  <div className="ld-folder-list">
                    {project.folders.map((folder, fi) => {
                      const fKey = `f:${idx}-${fi}`;
                      const fExpanded = isOpen(fKey);
                      const isActiveFolder = idx === activeIndex && fi === project.activeFolder;

                      return (
                        <div className="ld-folder-group" key={fi}>
                          <button
                            className={`ld-folder-header${isActiveFolder ? " active" : ""}`}
                            onClick={() => {
                              onSelectWorkspace(idx, fi);
                              toggleNode(fKey);
                            }}
                          >
                            <span className="ld-chevron">
                              {fExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </span>
                            <Folder size={12} />
                            <span className="ld-folder-name">{folder.name}</span>
                          </button>

                          {fExpanded && isActiveFolder && (
                            <div className="ld-screen-list">
                              {Object.entries(TIERS).map(([tier, info]) => {
                                const tierScreens = info.screens.filter((s) => existing.has(s));
                                if (!tierScreens.length) return null;
                                return (
                                  <div className="ld-tier-group" key={tier}>
                                    <div className="ld-tier-header">{tier} &mdash; {info.label}</div>
                                    {tierScreens.map((s) => (
                                      <button
                                        key={s}
                                        className={`ld-screen-item${s === activeScreen ? " active" : ""}`}
                                        onClick={() => { onSelectScreen(s); onToggle(); }}
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
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Version info at bottom */}
          {metadata && (
            <div className="ld-footer">
              <div className="ld-footer-version">
                <span>Version</span>
                <span>{metadata.meta.version}</span>
              </div>
              <div className="ld-footer-updated">
                <span>Updated</span>
                <span>{metadata.meta.lastUpdated}</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
