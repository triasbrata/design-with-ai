import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Menu, Plus, ChevronDown, ChevronRight, Folder, FolderOpen, Pin, Check, X, Trash2, Pencil } from "./base/icons";
import { screenName, truncateName, TIERS } from "../constants";
import { ConfirmModal } from "./ConfirmModal";
import type { Project } from "../types";
import { isSupported as fsIsSupported, pickDirectory, saveHandle, generateHandleId } from "../hooks/useFileSystem";

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
  onAddFolder?: (workspaceIdx: number, name: string, inputDir: string, outputDir: string, inputHandleId?: string, outputHandleId?: string) => void;
  onRemoveProject?: (index: number) => void;
  onRemoveFolder?: (projectIdx: number, folderIdx: number) => void;
  onRenameWorkspace?: (index: number, name: string) => void;
  onRenameFolder?: (projectIdx: number, folderIdx: number, name: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: "workspace" | "folder";
  projectIdx: number;
  folderIdx?: number;
}

interface RenameState {
  type: "workspace" | "folder";
  projectIdx: number;
  folderIdx?: number;
  currentName: string;
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
  onRemoveFolder,
  onRenameWorkspace,
  onRenameFolder,
}: LeftDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([activeIndex]));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ pi: number; fi: number; workspaceName: string; folderName: string } | null>(null);
  const [renameState, setRenameState] = useState<RenameState | null>(null);
  const [folderForm, setFolderForm] = useState<{
    workspaceIdx: number;
    name: string;
    inputDir: string;
    outputDir: string;
    inputHandleId?: string;
    outputHandleId?: string;
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

  /** Handle native directory picker via File System Access API */
  const handlePickFolderNative = useCallback(async () => {
    const dir = await pickDirectory();
    if (!dir) return;
    try {
      const handleId = generateHandleId();
      await saveHandle(handleId, dir.handle);
      setFolderForm((prev) =>
        prev
          ? {
              ...prev,
              name: dir.name || prev.name,
              inputHandleId: handleId,
              outputHandleId: handleId,
              inputDir: "",   // Clear path fields — handle takes precedence
              outputDir: "",
            }
          : null,
      );
    } catch {
      // Failed to save handle — silently ignore, user can retry
    }
  }, []);

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

  const handleContextMenu = useCallback((e: React.MouseEvent, projectIdx: number, type: "workspace" | "folder" = "workspace", folderIdx?: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, projectIdx, folderIdx });
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

  const handleRenameFromMenu = useCallback(() => {
    const state = contextMenu;
    if (!state) return;
    if (state.type === "workspace") {
      const project = projects[state.projectIdx];
      if (!project) return;
      setRenameState({ type: "workspace", projectIdx: state.projectIdx, currentName: project.name });
    } else {
      const project = projects[state.projectIdx];
      if (!project || project.type !== "workspace") return;
      const folder = project.folders[state.folderIdx!];
      if (!folder) return;
      setRenameState({ type: "folder", projectIdx: state.projectIdx, folderIdx: state.folderIdx, currentName: folder.name });
    }
    setContextMenu(null);
  }, [contextMenu, projects]);

  const handleRemoveFolderFromMenu = useCallback(() => {
    const state = contextMenu;
    if (!state || state.folderIdx === undefined) return;
    const project = projects[state.projectIdx];
    if (!project || project.type !== "workspace") return;
    if (project.folders.length <= 1) {
      setDeleteConfirm({ pi: state.projectIdx, fi: state.folderIdx, workspaceName: project.name, folderName: project.folders[state.folderIdx].name });
    } else {
      onRemoveFolder?.(state.projectIdx, state.folderIdx);
    }
    setContextMenu(null);
  }, [contextMenu, projects, onRemoveFolder]);

  const handleConfirmRename = useCallback(() => {
    if (!renameState) return;
    const trimmed = renameState.currentName.trim();
    if (!trimmed) { setRenameState(null); return; }
    if (renameState.type === "workspace") {
      onRenameWorkspace?.(renameState.projectIdx, trimmed);
    } else {
      onRenameFolder?.(renameState.projectIdx, renameState.folderIdx!, trimmed);
    }
    setRenameState(null);
  }, [renameState, onRenameWorkspace, onRenameFolder]);

  const handleCancelRename = useCallback(() => {
    setRenameState(null);
  }, []);

  const handleDoubleClickWorkspace = useCallback((pi: number, name: string) => {
    setRenameState({ type: "workspace", projectIdx: pi, currentName: name });
  }, []);

  const handleDoubleClickFolder = useCallback((pi: number, fi: number, name: string) => {
    setRenameState({ type: "folder", projectIdx: pi, folderIdx: fi, currentName: name });
  }, []);

  const handleSubmitFolder = useCallback(() => {
    if (!folderForm) return;
    const { workspaceIdx, name, inputDir, outputDir, inputHandleId, outputHandleId } = folderForm;
    if (!name.trim()) return;
    // Require either a path or a file system handle
    if (!inputDir.trim() && !inputHandleId) return;
    onAddFolder?.(
      workspaceIdx,
      name.trim(),
      inputDir.trim(),
      outputDir.trim() || inputDir.trim(),
      inputHandleId,
      outputHandleId,
    );
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
            <button className="ld-close-btn" onClick={onToggle} title="Close drawer">
              <X size={14} />
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
                    onContextMenu={(e) => handleContextMenu(e, pi, "workspace")}
                    style={isActiveWs ? { fontWeight: 600 } : undefined}
                  >
                    <Folder size={14} />
                    {renameState?.type === "workspace" && renameState.projectIdx === pi ? (
                      <>
                        <Pencil size={12} className="ld-rename-icon" />
                        <input
                          className="ld-rename-input"
                          autoFocus
                          value={renameState.currentName}
                          onChange={(e) => setRenameState((prev) => prev ? { ...prev, currentName: e.target.value } : null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleConfirmRename();
                            if (e.key === "Escape") handleCancelRename();
                          }}
                          onBlur={handleConfirmRename}
                        />
                      </>
                    ) : (
                      <span
                        className="ld-section-title"
                        title={project.name.length > 30 ? project.name : undefined}
                        onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClickWorkspace(pi, project.name); }}
                      >{truncateName(project.name)}</span>
                    )}
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
                            {fsIsSupported() && (
                              <button
                                className="ld-folder-browse"
                                onClick={handlePickFolderNative}
                                title="Pick folder using native file picker (persistent, survives reload)"
                              >
                                Pick Folder
                              </button>
                            )}
                          </div>
                          {folderForm.inputHandleId ? (
                            <div className="ld-folder-create-row" style={{ color: "var(--brand-muted)", fontSize: 11, padding: "4px 0" }}>
                              Using native file system access &mdash; no paths needed
                            </div>
                          ) : (
                            <>
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
                            </>
                          )}
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
                      {project.folders.length === 0 && (
                        <div style={{ padding: "8px 4px", color: "var(--brand-muted)", fontSize: 11 }}>
                          No folders — click + to add one
                        </div>
                      )}
                      {project.folders.map((folder, fi) => {
                        const isActiveFolder = isActiveWs && fi === activeFolderIdx;
                        const folderKey = `${pi}-${fi}`;
                        const isFolderExpanded = expandedFolders.has(folderKey);
                        return (
                          <div key={`f-${fi}`} style={{ paddingLeft: 4 }}>
                            <div className="ld-section-header" style={{ fontSize: 13 }}>
                              <span
                                className="ld-chevron"
                                onClick={() => {
                                  setExpandedFolders((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(folderKey)) next.delete(folderKey);
                                    else next.add(folderKey);
                                    return next;
                                  });
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                {isFolderExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              </span>
                              <Folder size={12} />
                              {renameState?.type === "folder" && renameState.projectIdx === pi && renameState.folderIdx === fi ? (
                                <>
                                  <Pencil size={12} className="ld-rename-icon" />
                                  <input
                                    ref={renameInputRef}
                                    className="ld-rename-input"
                                    value={renameState.currentName}
                                    onChange={(e) => setRenameState((prev) => prev ? { ...prev, currentName: e.target.value } : null)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleConfirmRename();
                                      if (e.key === "Escape") handleCancelRename();
                                    }}
                                    onBlur={handleConfirmRename}
                                  />
                                </>
                              ) : (
                                <span
                                  className="ld-section-title"
                                  title={folder.name.length > 30 ? folder.name : undefined}
                                  onClick={() => {
                                    if (!isActiveFolder) onSetActive(pi, fi);
                                  }}
                                  onContextMenu={(e) => handleContextMenu(e, pi, "folder", fi)}
                                  onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClickFolder(pi, fi, folder.name); }}
                                  style={{ cursor: 'pointer', fontWeight: isActiveFolder ? 600 : 400 }}
                                >
                                  {truncateName(folder.name)}
                                </span>
                              )}
                              <button
                                className="ld-folder-delete"
                                title="Delete folder"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (project.folders.length <= 1) {
                                    setDeleteConfirm({ pi, fi, workspaceName: project.name, folderName: folder.name });
                                  } else {
                                    onRemoveFolder?.(pi, fi);
                                  }
                                }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                            {(isActiveFolder || isFolderExpanded) && (
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
          {contextMenu.type === "workspace" ? (
            <>
              <button className="ld-context-item" onClick={handleRenameFromMenu}>
                Rename
              </button>
              <button className="ld-context-item" onClick={handleAddFolderFromMenu}>
                Add Folder
              </button>
              <button className="ld-context-item danger" onClick={handleRemoveProjectFromMenu}>
                Close Project
              </button>
            </>
          ) : (
            <>
              <button className="ld-context-item" onClick={handleRenameFromMenu}>
                Rename
              </button>
              <button className="ld-context-item danger" onClick={handleRemoveFolderFromMenu}>
                Delete Folder
              </button>
            </>
          )}
        </div>
      )}
      {deleteConfirm && (
        <ConfirmModal
          open
          title="Delete last folder"
          message={`"${deleteConfirm.folderName}" is the last folder in "${deleteConfirm.workspaceName}".\n\nDelete the entire workspace too?`}
          confirmLabel="Delete workspace"
          cancelLabel="Keep workspace"
          variant="danger"
          onConfirm={() => {
            onRemoveProject?.(deleteConfirm.pi);
            setDeleteConfirm(null);
          }}
          onCancel={() => {
            onRemoveFolder?.(deleteConfirm.pi, deleteConfirm.fi);
            setDeleteConfirm(null);
          }}
        />
      )}
    </>
  );
}
