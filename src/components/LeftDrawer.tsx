import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { cn } from "../lib/cn";
import { Menu, Plus, ChevronDown, ChevronRight, Folder, FolderOpen, Pin, Check, X, Trash2, Pencil, Search } from "./base/icons";
import { screenName, truncateName, TIERS } from "../constants";
import { ConfirmModal } from "./ConfirmModal";
import type { Project, Metadata } from "../types";
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
  onSelectScreen?: (screen: string) => void;
  onSelectWorkspace?: (idx: number, folderIdx?: number) => void;
  onRemoveFolder?: (projectIdx: number, folderIdx: number) => void;
  onRenameWorkspace?: (index: number, name: string) => void;
  onRenameFolder?: (projectIdx: number, folderIdx: number, name: string) => void;
  onScanProjects?: () => void;
  fileSourceType?: string | null;
  fileSourceLabel?: string;
  metadata?: Metadata | null;
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
  onSelectScreen,
  onSelectWorkspace,
  onRemoveFolder,
  onRenameWorkspace,
  onRenameFolder,
  onScanProjects,
  fileSourceType,
  fileSourceLabel,
  metadata,
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
      <div className="fixed top-3 left-3 z-[var(--z-drawer-trigger)]">
        <button type="button" className="w-8 h-8 rounded-lg border border-[var(--brand-border-hairline)] bg-[var(--brand-surface)] cursor-pointer flex items-center justify-center gap-[3px] shrink-0 p-0" onClick={onToggle} aria-expanded={open} aria-label="Toggle workspace">
          <Menu size={18} />
        </button>
      </div>
      <aside ref={drawerRef} className={cn(
        "shrink-0 h-screen overflow-y-auto overflow-x-hidden bg-bg-surface transition-[width] duration-[250ms] ease-linear",
        pinned ? "relative" : "fixed top-0 left-0 z-[var(--z-modal)]",
        open ? "visible pointer-events-auto border-r border-[var(--brand-border)]" : "invisible pointer-events-none border-r border-transparent",
      )} style={{ width: open ? 'var(--sidebar-width)' : 0 }} aria-hidden={!open}>
        <div className="w-[var(--sidebar-width)] px-3 py-4">
          <div className="flex justify-between items-center mb-1">
            <button
              type="button"
              className={cn(
                "flex items-center justify-center p-1 border-none rounded-[6px] bg-transparent text-tertiary cursor-pointer transition-[background,color] duration-150 hover:bg-primary_hover hover:text-brand-text",
                pinned && "text-brand-solid bg-primary_hover"
              )}
              onClick={onPinToggle}
              title={pinned ? "Switch to floating overlay" : "Pin (push mode)"}
            >
              <Pin size={14} />
            </button>
            <button type="button" className="flex items-center justify-center p-1 border-none rounded-[6px] bg-transparent text-tertiary cursor-pointer transition-[background,color] duration-150 hover:bg-[var(--brand-accent-light)] hover:text-brand-solid" onClick={onToggle} title="Close drawer">
              <X size={14} />
            </button>
          </div>
          {onAddWorkspace && (
            <>
              {showCreateForm ? (
                <div className="flex items-center gap-1.5 px-2 py-1.5 mb-3 border border-brand-border rounded-lg bg-bg-surface">
                  <input
                    ref={inputRef}
                    className="flex-1 border-none outline-none font-inherit text-xs text-brand-text bg-transparent p-1 placeholder:text-[var(--brand-muted-light)]"
                    placeholder="Workspace name"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitCreate();
                      if (e.key === "Escape") handleCancelCreate();
                    }}
                  />
                  <button type="button" className="flex items-center justify-center w-6 h-6 border-none rounded bg-[#22c55e] text-white cursor-pointer shrink-0 hover:bg-[#16a34a]" onClick={handleSubmitCreate}>
                    <Check size={14} />
                  </button>
                  <button type="button" className="flex items-center justify-center w-6 h-6 border-none rounded bg-transparent text-tertiary cursor-pointer shrink-0 hover:bg-primary_hover" onClick={handleCancelCreate}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button type="button" className="flex items-center gap-1.5 w-full px-3 py-2 mb-3 border border-dashed border-brand-border rounded-lg bg-transparent text-tertiary font-inherit text-xs cursor-pointer transition-[background] duration-150 hover:bg-primary_hover hover:text-brand-text" onClick={() => setShowCreateForm(true)}>
                  <Plus size={14} />
                  Add Workspace
                </button>
              )}
              {onScanProjects && !showCreateForm && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 w-full px-3 py-2 mb-3 border border-dashed border-brand-border rounded-lg bg-transparent text-tertiary font-inherit text-xs cursor-pointer transition-[background] duration-150 hover:bg-primary_hover hover:text-brand-text"
                  onClick={onScanProjects}
                  style={{ marginTop: 4 }}
                >
                  <Search size={14} />
                  Scan for projects
                </button>
              )}
            </>
          )}
          {projects.map((project, pi) => {
            const isActiveWs = pi === activeIndex;
            const isExpanded = expanded.has(pi);

            if (project.type === "workspace") {
              return (
                <div key={`ws-${pi}`}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-1.5 px-1.5 py-[7px] border-none bg-transparent cursor-pointer rounded-lg font-inherit text-xs font-bold text-brand-text text-left transition-[background] duration-100 hover:bg-primary_hover"
                    onClick={() => toggle(pi)}
                    onContextMenu={(e) => handleContextMenu(e, pi, "workspace")}
                    style={isActiveWs ? { fontWeight: 600 } : undefined}
                  >
                    <Folder size={14} />
                    {renameState?.type === "workspace" && renameState.projectIdx === pi ? (
                      <>
                        <Pencil size={12} className="text-tertiary shrink-0" />
                        <input
                          className="flex-1 border-none border-b border-[var(--brand-accent-muted)] rounded-none outline-none py-0.5 font-inherit text-xs text-brand-text bg-transparent"
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
                        className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                        title={project.name.length > 30 ? project.name : undefined}
                        onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClickWorkspace(pi, project.name); }}
                      >{truncateName(project.name)}</span>
                    )}
                    <button
                      type="button"
                      className="flex items-center justify-center w-[22px] h-[22px] border-none rounded bg-transparent text-tertiary cursor-pointer shrink-0 transition-[background,color] duration-150 hover:bg-primary_hover hover:text-brand-text"
                      title="Add folder"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderForm({ workspaceIdx: pi, name: "", inputDir: "", outputDir: "" });
                      }}
                    >
                      <Plus size={12} />
                    </button>
                    <span className="w-[14px] shrink-0 flex items-center text-tertiary ml-auto">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="pl-6 mb-2">
                      {folderForm && folderForm.workspaceIdx === pi && (
                        <div className="flex flex-col gap-1 px-2 py-1.5 mb-1 border border-brand-border rounded-lg bg-bg-surface">
                          <div className="flex gap-1 items-center">
                            <input
                              ref={folderInputRef}
                              className="flex-1 border border-[var(--brand-border-hairline)] rounded outline-none font-inherit text-[11px] text-brand-text bg-[var(--brand-bg)] px-1.5 py-1 focus:border-[var(--brand-accent-muted)]"
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
                            {fsIsSupported() ? (
                              <button
                                type="button"
                                className="font-inherit text-[10px] font-semibold px-2 py-1 border border-brand-border rounded bg-bg-surface text-tertiary cursor-pointer whitespace-nowrap hover:bg-primary_hover hover:text-brand-text"
                                onClick={handlePickFolderNative}
                                title="Pick folder using native file picker (persistent, survives reload)"
                              >
                                Pick Folder
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="font-inherit text-[10px] font-semibold px-2 py-1 border border-brand-border rounded bg-bg-surface text-tertiary cursor-pointer whitespace-nowrap hover:bg-primary_hover hover:text-brand-text"
                                onClick={() => folderFileInputRef.current?.click()}
                              >
                                Browse...
                              </button>
                            )}
                          </div>
                          {fsIsSupported() && folderForm.inputHandleId ? (
                            <div className="flex gap-1 items-center" style={{ color: "var(--brand-muted)", fontSize: 11, padding: "4px 0" }}>
                              Using native file system access &mdash; no paths needed
                            </div>
                          ) : !fsIsSupported() ? (
                            <>
                              <div className="flex gap-1 items-center">
                                <input
                                  className="flex-1 border border-[var(--brand-border-hairline)] rounded outline-none font-inherit text-[11px] text-brand-text bg-[var(--brand-bg)] px-1.5 py-1 focus:border-[var(--brand-accent-muted)]"
                                  placeholder="Input directory"
                                  value={folderForm.inputDir}
                                  onChange={(e) =>
                                    setFolderForm((prev) =>
                                      prev ? { ...prev, inputDir: e.target.value } : null,
                                    )
                                  }
                                />
                              </div>
                              <div className="flex gap-1 items-center">
                                <input
                                  className="flex-1 border border-[var(--brand-border-hairline)] rounded outline-none font-inherit text-[11px] text-brand-text bg-[var(--brand-bg)] px-1.5 py-1 focus:border-[var(--brand-accent-muted)]"
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
                          ) : null}
                          <div className="flex gap-1 justify-end">
                            <button type="button" className="flex items-center justify-center w-6 h-6 border-none rounded bg-transparent text-tertiary cursor-pointer shrink-0 hover:bg-primary_hover" onClick={handleCancelFolder}>
                              <X size={14} />
                            </button>
                            <button
                              type="button"
                              className="flex items-center justify-center w-6 h-6 border-none rounded bg-[#22c55e] text-white cursor-pointer shrink-0 hover:bg-[#16a34a]"
                              onClick={handleSubmitFolder}
                              {...(fsIsSupported() && !folderForm.inputHandleId ? { style: { opacity: 0.4 } as React.CSSProperties, title: "Pick a folder first" } : {})}
                            >
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
                            <div className="flex items-center gap-1.5 px-1.5 py-[5px] rounded-lg group" style={{ fontSize: 13 }}>
                              <span
                                className="w-[14px] shrink-0 flex items-center text-tertiary ml-auto"
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
                                  <Pencil size={12} className="text-tertiary shrink-0" />
                                  <input
                                    ref={renameInputRef}
                                    className="flex-1 border-none border-b border-[var(--brand-accent-muted)] rounded-none outline-none py-0.5 font-inherit text-xs text-brand-text bg-transparent"
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
                                  className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
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
                                <span
                                  className="inline-block text-[9px] font-semibold px-1.5 py-[1px] rounded whitespace-nowrap shrink-0 leading-[1.5]"
                                  style={{
                                    background: fileSourceType === 'fs-api' ? '#D4F5E4' : fileSourceType === 'vite-middleware' ? '#DBEAFE' : fileSourceType === 'upload' ? '#FFF1D6' : 'var(--brand-chip)',
                                    color: fileSourceType === 'fs-api' ? '#2D6A4F' : fileSourceType === 'vite-middleware' ? '#1E40AF' : fileSourceType === 'upload' ? '#8A6D3B' : 'var(--brand-muted)',
                                  }}
                                >
                                  {fileSourceLabel}
                                </span>
                              )}
                              <button
                                type="button"
                                className="flex items-center justify-center w-5 h-5 border-none rounded bg-transparent text-[var(--brand-muted-light)] cursor-pointer shrink-0 opacity-0 transition-[opacity,background,color] duration-150 group-hover:opacity-100 hover:!bg-[var(--brand-accent-light)] hover:!text-brand-solid"
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
                                    <div className="mb-2" key={tier}>
                                      <div className="text-[9px] font-bold uppercase text-brand-solid tracking-[0.5px] px-1.5 pt-[5px] pb-[3px]">
                                        {tier} — {info.label}
                                      </div>
                                      {tierScreens.map((s) => (
                                        <button
                                          type="button"
                                          key={s}
                                          className={cn(
                                            "block w-full text-[11px] px-2 py-1 rounded-lg text-secondary no-underline cursor-pointer bg-none border-none text-left font-inherit transition-[background] duration-100 whitespace-nowrap overflow-hidden text-ellipsis hover:bg-[var(--brand-chip)]",
                                            s === activeScreen && "bg-[var(--brand-accent-light)] text-brand-solid font-semibold",
                                          )}
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
                                  <div className="flex justify-center p-6 text-tertiary" style={{ padding: 12 }}>
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
              <div key={`client-${pi}`}>
                <button
                  type="button"
                  className="w-full flex items-center gap-1.5 px-1.5 py-[7px] border-none bg-transparent cursor-pointer rounded-lg font-inherit text-xs font-bold text-brand-text text-left transition-[background] duration-100 hover:bg-primary_hover"
                  onClick={() => {
                    if (!isActiveWs) onSetActive(pi);
                    toggle(pi);
                  }}
                  style={isActiveWs ? { fontWeight: 600 } : undefined}
                >
                  <FolderOpen size={14} />
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap" title={project.name.length > 30 ? project.name : undefined}>{truncateName(project.name)}</span>
                  <span className="w-[14px] shrink-0 flex items-center text-tertiary ml-auto">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
                {isExpanded && (
                  <div className="pl-6 mb-2" style={{ paddingLeft: 4 }}>
                    {Object.entries(TIERS).map(([tier, info]) => {
                      const tierScreens = info.screens.filter((s) => existing.has(s));
                      if (!tierScreens.length) return null;
                      return (
                        <div className="mb-2" key={tier}>
                          <div className="text-[9px] font-bold uppercase text-brand-solid tracking-[0.5px] px-1.5 pt-[5px] pb-[3px]">
                            {tier} — {info.label}
                          </div>
                          {tierScreens.map((s) => (
                            <button
                              type="button"
                              key={s}
                              className={cn(
                                "block w-full text-[11px] px-2 py-1 rounded-lg text-secondary no-underline cursor-pointer bg-none border-none text-left font-inherit transition-[background] duration-100 whitespace-nowrap overflow-hidden text-ellipsis hover:bg-[var(--brand-chip)]",
                                s === activeScreen && "bg-[var(--brand-accent-light)] text-brand-solid font-semibold",
                              )}
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

          {/* Version info at bottom */}
          {metadata && (
            <div className="mt-4 px-1.5 py-2 border-t border-[var(--brand-border-hairline)]">
              <div className="flex items-center justify-between text-[10px] text-tertiary font-medium leading-[1.8]">
                <span>Version</span>
                <span>{metadata.meta.version}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-tertiary font-medium leading-[1.8]">
                <span>Updated</span>
                <span>{metadata.meta.lastUpdated}</span>
              </div>
            </div>
          )}
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
          className="fixed z-[var(--z-context-menu)] min-w-[150px] bg-bg-surface border border-brand-border rounded-[10px] shadow-[0_4px_16px_var(--brand-shadow)] p-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === "workspace" ? (
            <>
              <button type="button" className="flex items-center gap-2 w-full px-3 py-2 border-none rounded-[6px] bg-transparent text-brand-text font-inherit text-xs cursor-pointer text-left hover:bg-primary_hover" onClick={handleRenameFromMenu}>
                Rename
              </button>
              <button type="button" className="flex items-center gap-2 w-full px-3 py-2 border-none rounded-[6px] bg-transparent text-brand-text font-inherit text-xs cursor-pointer text-left hover:bg-primary_hover" onClick={handleAddFolderFromMenu}>
                Add Folder
              </button>
              <button type="button" className="flex items-center gap-2 w-full px-3 py-2 border-none rounded-[6px] bg-transparent text-brand-solid font-inherit text-xs cursor-pointer text-left hover:bg-[var(--brand-accent-light)]" onClick={handleRemoveProjectFromMenu}>
                Close Project
              </button>
            </>
          ) : (
            <>
              <button type="button" className="flex items-center gap-2 w-full px-3 py-2 border-none rounded-[6px] bg-transparent text-brand-text font-inherit text-xs cursor-pointer text-left hover:bg-primary_hover" onClick={handleRenameFromMenu}>
                Rename
              </button>
              <button type="button" className="flex items-center gap-2 w-full px-3 py-2 border-none rounded-[6px] bg-transparent text-brand-solid font-inherit text-xs cursor-pointer text-left hover:bg-[var(--brand-accent-light)]" onClick={handleRemoveFolderFromMenu}>
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
