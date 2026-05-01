import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { SlideoutMenu } from "./application/slideout-menus/slideout-menu";
import { TreeView, type TreeItem } from "./application/tree-view/tree-view";
import { Menu, Plus, Pin, ChevronDown, ChevronRight, Folder, FolderOpen, Check, X, Trash2, Pencil, Loader2 } from "./base/icons";
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

function folderKey(pi: number, fi: number) { return `${pi}-${fi}`; }

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
  onRemoveProject,
  onRemoveFolder,
  onRenameWorkspace,
  onRenameFolder,
  onAddFolders,
  fileSourceType,
  fileSourceLabel,
}: LeftDrawerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([activeIndex]));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ pi: number; fi: number; workspaceName: string; folderName: string } | null>(null);
  const [renameState, setRenameState] = useState<RenameState | null>(null);
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

  const globalExisting = useMemo(() => new Set(screens), [screens]);

  // Auto-expand active workspace
  useEffect(() => {
    if (open) {
      setExpanded((prev) => new Set(prev).add(activeIndex));
    }
  }, [open, activeIndex]);

  // Auto-expand active folder but allow manual collapse
  useEffect(() => {
    if (activeIndex >= 0 && activeFolderIdx >= 0) {
      const fk = folderKey(activeIndex, activeFolderIdx);
      setExpandedFolders((prev) => new Set(prev).add(fk));
    }
  }, [activeIndex, activeFolderIdx]);

  useEffect(() => {
    if (showCreateForm && inputRef.current) inputRef.current.focus();
  }, [showCreateForm]);

  // Close context menu on outside click / escape
  useEffect(() => {
    if (!contextMenu) return;
    function handleClick(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) setContextMenu(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setContextMenu(null);
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

  function toggleWs(idx: number) {
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

  const handleContextMenu = useCallback((e: React.MouseEvent, pi: number, type: "workspace" | "folder" = "workspace", fi?: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, projectIdx: pi, folderIdx: fi });
  }, []);

  /** Pick folder via File System Access API, scan, show results modal */
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
        prev ? { ...prev, scanning: false, error: err instanceof Error ? err.message : "Scan failed" } : null,
      );
    }
  }, []);

  const handleAddFolderFromMenu = useCallback(() => {
    const state = contextMenu;
    if (!state) return;
    setContextMenu(null);
    handlePickAndScan(state.projectIdx);
  }, [contextMenu, handlePickAndScan]);

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

  const handleAddFoldersFromScan = useCallback(
    (selected: GoldenDirResult[]) => {
      if (!pickState) return;
      const wsIdx = pickState.workspaceIdx;
      const handleId = pickState.rootHandleId;
      const project = projects[wsIdx];
      const existingCount = project && project.type === "workspace" ? project.folders.length : 0;
      const newFolders: CaptureFolder[] = selected.map((r) => ({
        name: r.name,
        inputDir: "",
        outputDir: "",
        inputHandleId: handleId,
        outputHandleId: handleId,
        handlePath: r.relativePath,
      }));
      onAddFolders?.(wsIdx, newFolders);
      onSetActive?.(wsIdx, existingCount);
      setPickState(null);
    },
    [pickState, projects, onAddFolders, onSetActive],
  );

  // ── Build tree items from projects ──

  const treeItems = useMemo(() => {
    return projects.map((project, pi): TreeItem => {
      const isActiveWs = pi === activeIndex;
      const isExpanded = expanded.has(pi);

      if (project.type === "workspace") {
        return {
          id: `ws-${pi}`,
          label: renameState?.type === "workspace" && renameState.projectIdx === pi
            ? renameState.currentName
            : truncateName(project.name),
          icon: <Folder size={14} />,
          iconOpen: <Folder size={14} />,
          meta: { pi, type: "workspace", name: project.name },
          children: isExpanded ? project.folders.map((folder, fi): TreeItem => {
            const isActiveFolder = isActiveWs && fi === activeFolderIdx;
            const fk = folderKey(pi, fi);
            const isFolderExpanded = expandedFolders.has(fk);
            const cached = perFolderScreens[fk];
            const folderScreenList = (cached != null && cached.length > 0) ? cached : (isActiveFolder ? screens : undefined);
            const fsLoading = (cached == null) && (folder.inputHandleId || folder.inputDir);
            const existing = new Set(folderScreenList ?? []);

            return {
              id: fk,
              label: renameState?.type === "folder" && renameState.projectIdx === pi && renameState.folderIdx === fi
                ? renameState.currentName
                : truncateName(folder.name),
              icon: <Folder size={12} />,
              iconOpen: <Folder size={12} />,
              meta: { pi, fi, type: "folder", name: folder.name, isActiveFolder, isFolderExpanded, folderScreenList, fsLoading, existing, folder },
            };
          }) : [],
        };
      }

      // Client project
      return {
        id: `client-${pi}`,
        label: truncateName(project.name),
        icon: isExpanded ? <Folder size={14} /> : <Folder size={14} />,
        iconOpen: <Folder size={14} />,
        meta: { pi, type: "client", name: project.name },
        children: [],
      };
    });
  }, [projects, activeIndex, activeFolderIdx, expanded, expandedFolders, perFolderScreens, screens, renameState]);

  return (
    <>
      {/* Trigger button */}
      <div className="left-drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle workspace">
          <Menu size={18} />
        </button>
      </div>

      <SlideoutMenu
        isOpen={open}
        onOpenChange={(isOpen) => { if (!isOpen) onToggle(); }}
        className="!z-50 [&_[role=dialog]]:!left-0 [&_[role=dialog]]:!right-auto [&_[role=dialog]]:!w-[320px]"
      >
        {/* Pin button */}
        {onPinToggle && (
          <div className="flex items-center justify-end px-3 pt-3 pb-1">
            <button
              className={`flex items-center justify-center w-7 h-7 rounded-md border-none bg-transparent cursor-pointer transition-colors duration-150 ${
                pinned ? "text-brand-solid bg-primary_hover" : "text-tertiary hover:bg-primary_hover hover:text-secondary"
              }`}
              onClick={onPinToggle}
              title={pinned ? "Switch to floating overlay" : "Pin (push mode)"}
            >
              <Pin size={14} />
            </button>
          </div>
        )}

        {/* Add Workspace */}
        {onAddWorkspace && (
          <div className="px-2 pt-2">
            {showCreateForm ? (
              <div className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  className="flex-1 rounded-md border border-[var(--brand-border)] bg-bg-surface px-2 py-1 text-sm text-brand-text outline-none"
                  placeholder="Workspace name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmitCreate();
                    if (e.key === "Escape") handleCancelCreate();
                  }}
                />
                <button className="flex items-center justify-center size-6 rounded border-none bg-transparent text-brand-solid cursor-pointer hover:bg-primary_hover" onClick={handleSubmitCreate}>
                  <Check size={14} />
                </button>
                <button className="flex items-center justify-center size-6 rounded border-none bg-transparent text-tertiary cursor-pointer hover:bg-primary_hover" onClick={handleCancelCreate}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md border-none bg-transparent text-tertiary text-sm font-medium cursor-pointer transition-colors duration-150 hover:bg-primary_hover hover:text-secondary"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus size={14} />
                Add Workspace
              </button>
            )}
          </div>
        )}

        {/* Workspace Tree */}
        <div className="flex-1 min-h-0 overflow-y-auto px-1">
          <TreeView
            items={treeItems}
            size="sm"
            indent={12}
            expandedIds={expandedFolders}
            onExpandedChange={(ids: Set<string>) => setExpandedFolders(new Set(ids))}
            onSelect={(item: TreeItem) => {
              const meta = item.meta as Record<string, unknown> | undefined;
              if (!meta) return;
              const type = meta.type as string;
              const pi = meta.pi as number;
              if (type === "workspace") {
                toggleWs(pi);
                onSetActive(pi, 0);
              }
            }}
            onContextMenu={(e: React.MouseEvent, item: TreeItem) => {
              const meta = item.meta as Record<string, unknown> | undefined;
              if (!meta) return;
              const type = meta.type as string;
              const pi = meta.pi as number;
              const fi = meta.fi as number | undefined;
              if (type === "workspace" || type === "folder") {
                handleContextMenu(e as unknown as React.MouseEvent, pi, type, fi);
              }
            }}
            onDoubleClick={(item: TreeItem) => {
              const meta = item.meta as Record<string, unknown> | undefined;
              if (!meta) return;
              const type = meta.type as string;
              const pi = meta.pi as number;
              const fi = meta.fi as number | undefined;
              const name = meta.name as string;
              if (type === "workspace") {
                setRenameState({ type: "workspace", projectIdx: pi, currentName: name });
              } else if (type === "folder" && fi !== undefined) {
                setRenameState({ type: "folder", projectIdx: pi, folderIdx: fi, currentName: name });
              }
            }}
            renderActions={(item: TreeItem) => {
              const meta = item.meta as Record<string, unknown> | undefined;
              if (!meta) return null;
              const type = meta.type as string;
              const pi = meta.pi as number;
              const fi = meta.fi as number | undefined;

              if (type === "workspace") {
                return (
                  <>
                    <button
                      className="opacity-0 group-hover/tree-item:opacity-100 flex items-center justify-center size-5 rounded border-none bg-transparent text-tertiary cursor-pointer hover:text-secondary"
                      title="Add folder"
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); handlePickAndScan(pi); }}
                    >
                      <Plus size={12} />
                    </button>
                  </>
                );
              }
              if (type === "folder" && fi !== undefined) {
                return (
                  <>
                    {meta.isActiveFolder && fileSourceType && (
                      <span className={`ld-source-badge ${fileSourceType} text-[10px] px-1 py-0.5 rounded bg-primary_hover text-tertiary`}>{fileSourceLabel}</span>
                    )}
                    <button
                      className="opacity-0 group-hover/tree-item:opacity-100 flex items-center justify-center size-4 rounded border-none bg-transparent text-tertiary cursor-pointer hover:text-red-500"
                      title="Delete folder"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        const project = projects[pi];
                        if (!project || project.type !== "workspace") return;
                        if (project.folders.length <= 1) {
                          setDeleteConfirm({ pi, fi, workspaceName: project.name, folderName: meta.name as string });
                        } else {
                          onRemoveFolder?.(pi, fi);
                        }
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </>
                );
              }
              return null;
            }}
            renderContent={(item: TreeItem) => {
              const meta = item.meta as Record<string, unknown> | undefined;
              if (!meta) return null;
              const type = meta.type as string;
              const pi = meta.pi as number;
              const fi = meta.fi as number | undefined;

              // Folder expanded content: show screen list
              if (type === "folder" && fi !== undefined) {
                const isFolderExpanded = meta.isFolderExpanded as boolean;
                const isActiveFolder = meta.isActiveFolder as boolean;
                const folderScreenList = meta.folderScreenList as string[] | undefined;
                const fsLoading = meta.fsLoading as boolean;
                const existing = meta.existing as Set<string>;
                const folder = meta.folder as CaptureFolder;

                if (!isFolderExpanded && !isActiveFolder) return null;

                return (
                  <div style={{ paddingLeft: 20 }}>
                    {/* Path sub-text */}
                    <div className="text-[10px] text-tertiary px-1 pb-1 truncate">
                      {folder.handlePath && folder.handlePath.length > 0
                        ? folder.handlePath.join(" / ")
                        : folder.inputDir || ""}
                    </div>
                    {fsLoading && !folderScreenList ? (
                      <div className="flex items-center gap-1.5 px-1 py-1 text-[10px] text-tertiary">
                        <Loader2 size={11} className="animate-spin" />
                        Loading screens...
                      </div>
                    ) : folderScreenList && folderScreenList.length > 0 ? (
                      <>
                        {Object.entries(TIERS).map(([tier, info]) => {
                          const tierScreens = info.screens.filter((s) => existing.has(s));
                          if (!tierScreens.length) return null;
                          return (
                            <div key={tier} className="mb-1">
                              <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider px-1 py-0.5">
                                {tier} — {info.label}
                              </div>
                              {tierScreens.map((s) => (
                                <button
                                  key={s}
                                  className={`w-full text-left text-xs px-2 py-1 rounded-md border-none bg-transparent cursor-pointer transition-colors duration-100 truncate block ${
                                    s === activeScreen
                                      ? "text-brand-solid font-semibold bg-primary_hover"
                                      : "text-secondary hover:bg-primary_hover"
                                  }`}
                                  onClick={() => { onSelect(s); onToggle(); }}
                                  title={screenName(s)}
                                >
                                  {truncateName(screenName(s))}
                                </button>
                              ))}
                            </div>
                          );
                        })}
                        {(() => {
                          const tieredAll = Object.values(TIERS).flatMap((t) => t.screens);
                          const orphanScreens = folderScreenList.filter((s) => !tieredAll.includes(s));
                          if (!orphanScreens.length) return null;
                          return (
                            <div className="mb-1">
                              <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider px-1 py-0.5">Other</div>
                              {orphanScreens.map((s) => (
                                <button
                                  key={s}
                                  className={`w-full text-left text-xs px-2 py-1 rounded-md border-none bg-transparent cursor-pointer transition-colors duration-100 truncate block ${
                                    s === activeScreen
                                      ? "text-brand-solid font-semibold bg-primary_hover"
                                      : "text-secondary hover:bg-primary_hover"
                                  }`}
                                  onClick={() => { onSelect(s); onToggle(); }}
                                  title={screenName(s)}
                                >
                                  {truncateName(screenName(s))}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="px-1 py-2 text-[10px] text-tertiary">No screens found</div>
                    )}
                  </div>
                );
              }

              // Client project expanded content: show tiered screen list
              if (type === "client" && meta.isExpanded) {
                if (globalExisting.size === 0) {
                  return <div className="px-6 py-2 text-xs text-tertiary">No screens loaded</div>;
                }
                const tieredAll = Object.values(TIERS).flatMap((t) => t.screens);
                const orphanScreens = [...globalExisting].filter((s) => !tieredAll.includes(s));
                return (
                  <div style={{ paddingLeft: 20 }}>
                    {Object.entries(TIERS).map(([tier, info]) => {
                      const tierScreens = info.screens.filter((s) => globalExisting.has(s));
                      if (!tierScreens.length) return null;
                      return (
                        <div key={tier} className="mb-1">
                          <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider px-1 py-0.5">
                            {tier} — {info.label}
                          </div>
                          {tierScreens.map((s) => (
                            <button
                              key={s}
                              className={`w-full text-left text-xs px-2 py-1 rounded-md border-none bg-transparent cursor-pointer transition-colors duration-100 truncate block ${
                                s === activeScreen
                                  ? "text-brand-solid font-semibold bg-primary_hover"
                                  : "text-secondary hover:bg-primary_hover"
                              }`}
                              onClick={() => { onSelect(s); onToggle(); }}
                              title={screenName(s)}
                            >
                              {truncateName(screenName(s))}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                    {orphanScreens.length > 0 && (
                      <div className="mb-1">
                        <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider px-1 py-0.5">Other</div>
                        {orphanScreens.map((s) => (
                          <button
                            key={s}
                            className={`w-full text-left text-xs px-2 py-1 rounded-md border-none bg-transparent cursor-pointer transition-colors duration-100 truncate block ${
                              s === activeScreen
                                ? "text-brand-solid font-semibold bg-primary_hover"
                                : "text-secondary hover:bg-primary_hover"
                            }`}
                            onClick={() => { onSelect(s); onToggle(); }}
                            title={screenName(s)}
                          >
                            {truncateName(screenName(s))}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            }}
            renderLabel={(item: TreeItem, _path: number[], _exp: boolean) => {
              const meta = item.meta as Record<string, unknown> | undefined;
              if (!meta) return item.label;
              const type = meta.type as string;
              const pi = meta.pi as number;
              const fi = meta.fi as number | undefined;

              // Inline rename for workspace
              if (type === "workspace" && renameState?.type === "workspace" && renameState.projectIdx === pi) {
                return (
                  <span className="flex items-center gap-1 flex-1 min-w-0">
                    <Pencil size={10} className="shrink-0 text-tertiary" />
                    <input
                      className="flex-1 min-w-0 rounded border border-[var(--brand-border)] bg-bg-surface px-1 py-0 text-xs text-brand-text outline-none"
                      autoFocus
                      value={renameState.currentName}
                      onChange={(e) => setRenameState((prev) => prev ? { ...prev, currentName: e.target.value } : null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmRename();
                        if (e.key === "Escape") setRenameState(null);
                      }}
                      onBlur={handleConfirmRename}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </span>
                );
              }

              // Inline rename for folder
              if (type === "folder" && renameState?.type === "folder" && renameState.projectIdx === pi && renameState.folderIdx === fi) {
                return (
                  <span className="flex items-center gap-1 flex-1 min-w-0">
                    <Pencil size={10} className="shrink-0 text-tertiary" />
                    <input
                      className="flex-1 min-w-0 rounded border border-[var(--brand-border)] bg-bg-surface px-1 py-0 text-xs text-brand-text outline-none"
                      autoFocus
                      value={renameState.currentName}
                      onChange={(e) => setRenameState((prev) => prev ? { ...prev, currentName: e.target.value } : null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmRename();
                        if (e.key === "Escape") setRenameState(null);
                      }}
                      onBlur={handleConfirmRename}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </span>
                );
              }

              return (
                <span
                  className="truncate"
                  title={(meta.name as string)?.length > 30 ? (meta.name as string) : undefined}
                >
                  {item.label}
                </span>
              );
            }}
          />

          {/* Scanning indicator */}
          {pickState?.scanning && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-tertiary">
              <Loader2 size={12} className="animate-spin" />
              Scanning folders...
            </div>
          )}
        </div>
      </SlideoutMenu>

      {/* Context menu (rendered outside slideout for proper z-index) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[9999] bg-bg-surface rounded-lg shadow-[0_8px_24px_var(--brand-shadow)] border border-[var(--brand-border)] py-1.5 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === "workspace" ? (
            <>
              <button className="w-full text-left px-3 py-1.5 text-sm text-secondary border-none bg-transparent cursor-pointer hover:bg-primary_hover" onClick={handleRenameFromMenu}>
                Rename
              </button>
              <button className="w-full text-left px-3 py-1.5 text-sm text-secondary border-none bg-transparent cursor-pointer hover:bg-primary_hover" onClick={handleAddFolderFromMenu}>
                Add Folder
              </button>
              <button className="w-full text-left px-3 py-1.5 text-sm text-red-500 border-none bg-transparent cursor-pointer hover:bg-red-50" onClick={handleRemoveProjectFromMenu}>
                Close Project
              </button>
            </>
          ) : (
            <>
              <button className="w-full text-left px-3 py-1.5 text-sm text-secondary border-none bg-transparent cursor-pointer hover:bg-primary_hover" onClick={handleRenameFromMenu}>
                Rename
              </button>
              <button className="w-full text-left px-3 py-1.5 text-sm text-red-500 border-none bg-transparent cursor-pointer hover:bg-red-50" onClick={handleRemoveFolderFromMenu}>
                Delete Folder
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
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

      {/* Scan results modal */}
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
    </>
  );
}
