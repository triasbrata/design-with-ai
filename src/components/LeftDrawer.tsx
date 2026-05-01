import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Menu, Plus, ChevronDown, ChevronRight, Folder, FolderOpen, Pin, Check, X, Trash2, Pencil, Loader2 } from "./base/icons";
import { screenName, truncateName, TIERS } from "../constants";
import { ConfirmModal } from "./ConfirmModal";
import { ScanResultsModal } from "./ScanResultsModal";
import type { Project, CaptureFolder } from "../types";
import { isSupported as fsIsSupported, pickDirectory, saveHandle, generateHandleId, scanForGoldenDirectories } from "../hooks/useFileSystem";
import type { GoldenDirResult } from "../hooks/useFileSystem";

interface LeftDrawerProps {
  open: boolean;
  onToggle: () => void;
  pinned: boolean;
  onPinToggle: () => void;
  projects: Project[];
  activeIndex: number;
  activeFolderIdx: number;
  screens: string[];
  perFolderScreens: Record<string, string[]>;
  activeScreen: string;
  onSelect: (screen: string) => void;
  onSetActive: (index: number, folderIdx?: number) => void;
  onAddWorkspace?: (name: string) => void;
  onAddFolder?: (workspaceIdx: number, name: string, inputDir: string, outputDir: string, inputHandleId?: string, outputHandleId?: string) => void;
  onRemoveProject?: (index: number) => void;
  onRemoveFolder?: (projectIdx: number, folderIdx: number) => void;
  onRenameWorkspace?: (index: number, name: string) => void;
  onRenameFolder?: (projectIdx: number, folderIdx: number, name: string) => void;
  onAddFolders?: (workspaceIdx: number, folders: CaptureFolder[]) => void;
  fileSourceType?: string | null;
  fileSourceLabel?: string;
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
  perFolderScreens,
  activeScreen,
  onSelect,
  onSetActive,
  onAddWorkspace,
  onAddFolder,
  onRemoveProject,
  onRemoveFolder,
  onRenameWorkspace,
  onRenameFolder,
  onAddFolders,
  fileSourceType,
  fileSourceLabel,
}: LeftDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([activeIndex]));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ pi: number; fi: number; workspaceName: string; folderName: string } | null>(null);
  const [renameState, setRenameState] = useState<RenameState | null>(null);
  const [showFolderForm, setShowFolderForm] = useState<number | null>(null);
  const [pickState, setPickState] = useState<{
    workspaceIdx: number;
    scanning: boolean;
    results: GoldenDirResult[] | null;
    rootHandleId: string;
    rootHandle: FileSystemDirectoryHandle | null;
    skippedMalformed: number;
    skippedPermission: number;
    emptyHtmlCount: number;
    error: string | null;
  } | null>(null);

  // Compute existing handle paths for dedup in ScanResultsModal
  const existingHandlePaths = useMemo(() => {
    const paths = new Set<string>();
    projects.forEach((p) => {
      if (p.type === "workspace") {
        p.folders.forEach((f) => {
          if (f.handlePath && f.inputHandleId) {
            paths.add(`${f.inputHandleId}::${JSON.stringify(f.handlePath)}`);
          }
        });
      }
    });
    return paths;
  }, [projects]);

  // Global existing set for client projects (unchanged)
  const globalExisting = useMemo(() => new Set(screens), [screens]);

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
    setShowFolderForm(state.projectIdx);
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

  /** Pick a folder via File System Access API, scan for golden spec dirs, show results modal */
  const handlePickAndScan = useCallback(async (workspaceIdx: number) => {
    const dir = await pickDirectory();
    if (!dir) return;

    setPickState({
      workspaceIdx,
      scanning: true,
      results: null,
      rootHandleId: "",
      rootHandle: dir.handle,
      skippedMalformed: 0,
      skippedPermission: 0,
      emptyHtmlCount: 0,
      error: null,
    });

    try {
      const handleId = generateHandleId();
      await saveHandle(handleId, dir.handle);

      const scanResult = await scanForGoldenDirectories(dir.handle);
      // Post-filter: remove folders with 0 HTML files
      const valid: GoldenDirResult[] = [];
      let emptyHtml = 0;
      for (const f of scanResult.folders) {
        if (f.htmlFileCount > 0) valid.push(f);
        else emptyHtml++;
      }

      setPickState({
        workspaceIdx,
        scanning: false,
        results: valid,
        rootHandleId: handleId,
        rootHandle: dir.handle,
        skippedMalformed: scanResult.malformedCount,
        skippedPermission: scanResult.permissionDeniedCount,
        emptyHtmlCount: emptyHtml,
        error: null,
      });
    } catch (err) {
      setPickState((prev) =>
        prev
          ? {
              ...prev,
              scanning: false,
              error: err instanceof Error ? err.message : "Scan failed",
            }
          : null,
      );
    }
  }, []);

  /** Add user-selected folders from scan results to workspace */
  const handleAddFoldersFromScan = useCallback(
    (selected: GoldenDirResult[]) => {
      if (!pickState) return;
      const wsIdx = pickState.workspaceIdx;
      const handleId = pickState.rootHandleId;

      const project = projects[wsIdx];
      const existingCount =
        project && project.type === "workspace" ? project.folders.length : 0;

      const newFolders: CaptureFolder[] = selected.map((r) => ({
        name: r.name,
        inputDir: "",
        outputDir: "",
        inputHandleId: handleId,
        outputHandleId: handleId,
        handlePath: r.relativePath,
      }));

      onAddFolders?.(wsIdx, newFolders);
      onSetActive?.(wsIdx, existingCount); // auto-activate first new folder
      setPickState(null);
      setShowFolderForm(null);
    },
    [pickState, projects, onAddFolders, onSetActive],
  );

  /** Derive screen list and existing set for a specific folder */
  function folderKey(pi: number, fi: number) { return `${pi}-${fi}`; }

  return (
    <div data-caid="left-drawer">
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
                        setShowFolderForm(pi);
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
                      {showFolderForm === pi && (
                        <div className="ld-folder-create">
                          <div className="ld-folder-create-row">
                            {fsIsSupported() ? (
                              <button
                                className="ld-folder-browse"
                                onClick={() => handlePickAndScan(pi)}
                                disabled={pickState?.scanning ?? false}
                                title="Pick folder using native file picker (persistent, survives reload)"
                              >
                                {pickState?.scanning ? "Scanning..." : "Pick Folder"}
                              </button>
                            ) : (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "var(--brand-muted)",
                                  padding: "4px 0",
                                }}
                              >
                                File System Access API not supported in this browser
                              </span>
                            )}
                            </div>
                          </div>
                        )}
                        {pickState?.scanning && pickState.workspaceIdx === pi && (
                        <div className="ld-scanning">
                          <Loader2 size={12} className="ld-spinner" />
                          <span>Scanning folders...</span>
                        </div>
                      )}
                      {project.folders.length === 0 && !pickState?.scanning && (
                        <div style={{ padding: "8px 4px", color: "var(--brand-muted)", fontSize: 11 }}>
                          No folders — click + to add one
                        </div>
                      )}
                      {project.folders.map((folder, fi) => {
                        const isActiveFolder = isActiveWs && fi === activeFolderIdx;
                        const fk = folderKey(pi, fi);
                        const isFolderExpanded = expandedFolders.has(fk);

                        // Per-folder screen list from eager cache; fall back to global for active folder if cache not yet populated or empty (e.g. failed eager load)
                        const cached = perFolderScreens[fk];
                        const folderScreenList = (cached != null && cached.length > 0) ? cached : (isActiveFolder ? screens : undefined);
                        const fsLoading = (cached == null) && (folder.inputHandleId || folder.inputDir);
                        const existing = new Set(folderScreenList ?? []);

                        return (
                          <div key={`f-${fi}`} style={{ paddingLeft: 4 }}>
                            <div className="ld-section-header" style={{ fontSize: 13 }}>
                              <span
                                className="ld-chevron"
                                onClick={() => {
                                  setExpandedFolders((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(fk)) next.delete(fk);
                                    else next.add(fk);
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
                              {isActiveFolder && fileSourceType && (
                                <span className={`ld-source-badge ${fileSourceType}`}>{fileSourceLabel}</span>
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
                            {/* Path sub-text */}
                            <div className="ld-folder-path">
                              {folder.handlePath && folder.handlePath.length > 0
                                ? folder.handlePath.join(" / ")
                                : folder.inputDir || ""}
                            </div>
                            {(isActiveFolder || isFolderExpanded) && (
                              <div style={{ paddingLeft: 8 }}>
                                {fsLoading && !folderScreenList ? (
                                  <div style={{ padding: "8px 4px", color: "var(--brand-muted)", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                                    <Loader2 size={11} className="ld-spinner" />
                                    Loading screens...
                                  </div>
                                ) : folderScreenList && folderScreenList.length > 0 ? (
                                  (() => {
                                    const tieredAll = Object.values(TIERS).flatMap((t) => t.screens);
                                    const orphanScreens = folderScreenList.filter((s) => !tieredAll.includes(s));
                                    return (
                                      <>
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
                                        {orphanScreens.length > 0 && (
                                          <div className="ld-tier-group" key="orphan">
                                            <div className="ld-tier-label">Other</div>
                                            {orphanScreens.map((s) => (
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
                                        )}
                                      </>
                                    );
                                  })()
                                ) : (
                                  <div style={{ padding: 12, color: "var(--brand-muted)", fontSize: 12 }}>
                                    No screens found
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
                    {(() => {
                      const tieredAll = Object.values(TIERS).flatMap((t) => t.screens);
                      const orphanScreens = [...globalExisting].filter((s) => !tieredAll.includes(s));
                      return (
                        <>
                          {Object.entries(TIERS).map(([tier, info]) => {
                            const tierScreens = info.screens.filter((s) => globalExisting.has(s));
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
                          {orphanScreens.length > 0 && (
                            <div className="ld-tier-group" key="orphan">
                              <div className="ld-tier-label">Other</div>
                              {orphanScreens.map((s) => (
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
                          )}
                        </>
                      );
                    })()}
                    {globalExisting.size === 0 && (
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
      {pickState && (
        <ScanResultsModal
          open={true}
          scanning={pickState.scanning}
          onClose={() => setPickState(null)}
          onAddFolders={handleAddFoldersFromScan}
          onRetry={() => {
            setPickState(null);
            handlePickAndScan(pickState.workspaceIdx);
          }}
          folders={pickState.results || []}
          existingHandlePaths={existingHandlePaths}
          skippedMalformed={pickState.skippedMalformed}
          skippedPermission={pickState.skippedPermission}
          emptyHtmlCount={pickState.emptyHtmlCount}
          error={pickState.error}
          parentFolderName={pickState.rootHandle?.name}
          rootHandleId={pickState.rootHandleId}
        />
      )}
    </div>
  );
}
