import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Menu, Plus, ChevronDown, ChevronRight, Folder, FolderOpen, Pin, Check, X } from "./base/icons";
import { screenName, truncateName, TIERS } from "../constants";
import type { Project } from "../types";

interface LeftDrawerProps {
  open: boolean;
  onToggle: () => void;
  pinned: boolean;
  onPinToggle: () => void;
  projects: Project[];
  activeIndex: number;
  activeFolderIdx: number;
  screens: string[];
  activeScreen: string;
  onSelect: (screen: string) => void;
  onSetActive: (index: number, folderIdx?: number) => void;
  onAddWorkspace?: (name: string) => void;
  onAddFolder?: (workspaceIdx: number, name: string, inputDir: string, outputDir: string) => void;
  onRemoveProject?: (index: number) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  projectIdx: number;
}

export function LeftDrawer({
  open,
  onToggle,
  pinned,
  onPinToggle,
  projects,
  activeIndex,
  activeFolderIdx,
  screens,
  activeScreen,
  onSelect,
  onSetActive,
  onAddWorkspace,
  onAddFolder,
  onRemoveProject,
}: LeftDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([activeIndex]));
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [folderForm, setFolderForm] = useState<{
    workspaceIdx: number;
    name: string;
    inputDir: string;
    outputDir: string;
  } | null>(null);
  const folderFileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-expand active workspace when drawer opens
  useEffect(() => {
    if (open) {
      setExpanded((prev) => new Set(prev).add(activeIndex));
    }
  }, [open, activeIndex]);

  // Auto-focus input when create form appears
  useEffect(() => {
    if (showCreateForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCreateForm]);

  // Auto-focus folder name input when folder form appears
  useEffect(() => {
    if (folderForm && folderInputRef.current) {
      folderInputRef.current.focus();
    }
  }, [folderForm]);

  // Close context menu on outside click and escape
  useEffect(() => {
    if (!contextMenu) return;

    function handleClick(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    }

    // Delay outside-click listener to avoid immediate close from the right-click itself
    const tick = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }, 0);

    return () => {
      clearTimeout(tick);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const handleBrowseFolder = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const firstFile = files[0];
      const folderName = firstFile.webkitRelativePath.split("/")[0];
      const parts = firstFile.webkitRelativePath.split("/");
      const docsIdx = parts.findIndex((p) => p === "docs" || p === "golden");
      let inputDir = "";
      if (docsIdx >= 0) {
        inputDir = "../../" + parts.slice(docsIdx).join("/").replace(/\/[^/]+$/, "/");
      }
      setFolderForm((prev) =>
        prev
          ? {
              ...prev,
              name: folderName,
              inputDir: inputDir || "",
              outputDir: inputDir || "",
            }
          : null,
      );
      e.target.value = "";
    },
    [],
  );

  const existing = useMemo(() => new Set(screens), [screens]);

  function toggle(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const handleSubmitCreate = useCallback(() => {
    const trimmed = createName.trim();
    if (!trimmed) return;
    onAddWorkspace?.(trimmed);
    setCreateName("");
    setShowCreateForm(false);
  }, [createName, onAddWorkspace]);

  const handleCancelCreate = useCallback(() => {
    setCreateName("");
    setShowCreateForm(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, projectIdx: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, projectIdx });
  }, []);

  const handleAddFolderFromMenu = useCallback(() => {
    const state = contextMenu;
    if (!state) return;
    setFolderForm({ workspaceIdx: state.projectIdx, name: "", inputDir: "", outputDir: "" });
    setContextMenu(null);
  }, [contextMenu]);

  const handleRemoveProjectFromMenu = useCallback(() => {
    const state = contextMenu;
    if (!state) return;
    onRemoveProject?.(state.projectIdx);
    setContextMenu(null);
  }, [contextMenu, onRemoveProject]);

  const handleSubmitFolder = useCallback(() => {
    if (!folderForm) return;
    const { workspaceIdx, name, inputDir, outputDir } = folderForm;
    if (!name.trim() || !inputDir.trim()) return;
    onAddFolder?.(workspaceIdx, name.trim(), inputDir.trim(), outputDir.trim() || inputDir.trim());
    setFolderForm(null);
  }, [folderForm, onAddFolder]);

  const handleCancelFolder = useCallback(() => {
    setFolderForm(null);
  }, []);

  return (
    <>
      <div className="left-drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle workspace">
          <Menu size={18} />
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
          </div>
          {onAddWorkspace && (
            <>
              {showCreateForm ? (
                <div className="ld-inline-create">
                  <input
                    ref={inputRef}
                    className="ld-inline-input"
                    placeholder="Workspace name"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitCreate();
                      if (e.key === "Escape") handleCancelCreate();
                    }}
                  />
                  <button className="ld-inline-confirm" onClick={handleSubmitCreate}>
                    <Check size={14} />
                  </button>
                  <button className="ld-inline-cancel" onClick={handleCancelCreate}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button className="ld-add-workspace" onClick={() => setShowCreateForm(true)}>
                  <Plus size={14} />
                  Add Workspace
                </button>
              )}
            </>
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
                    onContextMenu={(e) => handleContextMenu(e, pi)}
                    style={isActiveWs ? { fontWeight: 600 } : undefined}
                  >
                    <Folder size={14} />
                    <span className="ld-section-title" title={project.name.length > 30 ? project.name : undefined}>{truncateName(project.name)}</span>
                    <button
                      className="ld-folder-add"
                      title="Add folder"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderForm({ workspaceIdx: pi, name: "", inputDir: "", outputDir: "" });
                      }}
                    >
                      <Plus size={12} />
                    </button>
                    <span className="ld-chevron">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ld-section-body">
                      {folderForm && folderForm.workspaceIdx === pi && (
                        <div className="ld-folder-create">
                          <div className="ld-folder-create-row">
                            <input
                              ref={folderInputRef}
                              className="ld-folder-input"
                              placeholder="Folder name"
                              value={folderForm.name}
                              onChange={(e) =>
                                setFolderForm((prev) =>
                                  prev ? { ...prev, name: e.target.value } : null,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSubmitFolder();
                                if (e.key === "Escape") handleCancelFolder();
                              }}
                            />
                            <button
                              className="ld-folder-browse"
                              onClick={() => folderFileInputRef.current?.click()}
                            >
                              Browse...
                            </button>
                          </div>
                          <div className="ld-folder-create-row">
                            <input
                              className="ld-folder-input"
                              placeholder="Input directory"
                              value={folderForm.inputDir}
                              onChange={(e) =>
                                setFolderForm((prev) =>
                                  prev ? { ...prev, inputDir: e.target.value } : null,
                                )
                              }
                            />
                          </div>
                          <div className="ld-folder-create-row">
                            <input
                              className="ld-folder-input"
                              placeholder="Same as input directory"
                              value={folderForm.outputDir}
                              onChange={(e) =>
                                setFolderForm((prev) =>
                                  prev ? { ...prev, outputDir: e.target.value } : null,
                                )
                              }
                            />
                          </div>
                          <div className="ld-folder-create-actions">
                            <button className="ld-inline-cancel" onClick={handleCancelFolder}>
                              <X size={14} />
                            </button>
                            <button className="ld-inline-confirm" onClick={handleSubmitFolder}>
                              <Check size={14} />
                            </button>
                          </div>
                        </div>
                      )}
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
                              <Folder size={12} />
                              <span className="ld-section-title" title={folder.name.length > 30 ? folder.name : undefined}>{truncateName(folder.name)}</span>
                              <span className="ld-chevron">
                                {isActiveFolder ? (
                                  <ChevronDown size={12} />
                                ) : (
                                  <ChevronRight size={12} />
                                )}
                              </span>
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
                                          {truncateName(screenName(s))}
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
                  <FolderOpen size={14} />
                  <span className="ld-section-title" title={project.name.length > 30 ? project.name : undefined}>{truncateName(project.name)}</span>
                  <span className="ld-chevron">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
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
                              {truncateName(screenName(s))}
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
        {/* Hidden file input for native folder picker */}
        <input
          ref={folderFileInputRef}
          type="file"
          style={{ display: "none" }}
          // @ts-ignore
          webkitdirectory=""
          directory=""
          onChange={handleBrowseFolder}
        />
      </aside>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="ld-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className="ld-context-item" onClick={handleAddFolderFromMenu}>
            Add Folder
          </button>
          <button className="ld-context-item danger" onClick={handleRemoveProjectFromMenu}>
            Close Project
          </button>
        </div>
      )}
    </>
  );
}
