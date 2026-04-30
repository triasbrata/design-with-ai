import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import type { Project, Metadata, CaptureFolder } from "../types";
import type { ClientFileEntry } from "../types";
import { Button } from "./base";
import {
  Check,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  FileInput,
} from "./base/icons";

interface ProjectSelectorProps {
  projects: Project[];
  activeIndex: number;
  onSelect: (index: number, folderIdx?: number) => void;
  onAddProject: (project: Project) => void;
  onAddFolder: (workspaceIdx: number, folder: CaptureFolder) => void;
  onRemoveProject: (index: number) => void;
  onRemoveFolder: (projectIdx: number, folderIdx: number) => void;
}

export function ProjectSelector({
  projects,
  activeIndex,
  onSelect,
  onAddProject,
  onAddFolder,
  onRemoveProject,
  onRemoveFolder,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderWorkspaceIdx, setFolderWorkspaceIdx] = useState(0);
  const [browsing, setBrowsing] = useState(false);

  // New workspace form
  const [wsName, setWsName] = useState("");
  const [folderName, setFolderName] = useState("");
  const [inputDir, setInputDir] = useState("");
  const [outputDir, setOutputDir] = useState("");

  // Add folder form
  const [afName, setAfName] = useState("");
  const [afInputDir, setAfInputDir] = useState("");
  const [afOutputDir, setAfOutputDir] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Reset workspace form
  function resetWsForm() {
    setWsName("");
    setFolderName("");
    setInputDir("");
    setOutputDir("");
  }

  // Reset add folder form
  function resetAfForm() {
    setAfName("");
    setAfInputDir("");
    setAfOutputDir("");
  }

  // Submit new workspace (with initial folder)
  function handleNewWorkspace() {
    const name = wsName.trim();
    const fName = folderName.trim();
    const iDir = inputDir.trim();
    const oDir = outputDir.trim() || iDir;
    if (!name || !fName || !iDir) return;

    onAddProject({
      type: "workspace",
      name,
      activeFolder: 0,
      folders: [{ name: fName, inputDir: iDir, outputDir: oDir }],
    });

    resetWsForm();
    setShowWorkspaceModal(false);
  }

  // Submit add folder to existing workspace
  function handleAddFolder() {
    const name = afName.trim();
    const iDir = afInputDir.trim();
    const oDir = afOutputDir.trim() || iDir;
    if (!name || !iDir) return;

    onAddFolder(folderWorkspaceIdx, { name, inputDir: iDir, outputDir: oDir });
    resetAfForm();
    setShowFolderModal(false);
  }

  // Open "Add Folder" modal for a specific workspace
  function openAddFolder(workspaceIdx: number) {
    setFolderWorkspaceIdx(workspaceIdx);
    resetAfForm();
    setShowFolderModal(true);
  }

  // Handle folder selection via webkitdirectory input
  const handleBrowse = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setBrowsing(true);

      try {
        const fileArray = Array.from(files);

        const metaFile = fileArray.find((f) => f.name === "screen-metadata.json");
        if (!metaFile) {
          console.warn("No screen-metadata.json found in selected folder");
          setBrowsing(false);
          return;
        }

        const metaText = await metaFile.text();
        const metadata: Metadata = JSON.parse(metaText);

        const entries: ClientFileEntry[] = [];
        const htmlFiles = fileArray.filter((f) => f.name.endsWith(".html"));
        for (const file of htmlFiles) {
          const blobUrl = URL.createObjectURL(file);
          entries.push({ name: file.name, blobUrl });
        }

        const firstFile = fileArray[0];
        const folderName = firstFile.webkitRelativePath.split("/")[0];
        const projectName = folderName
          .replace(/[_-]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        onAddProject({
          type: "client",
          name: projectName,
          files: entries,
          metadata,
        });
      } catch (err) {
        console.error("Failed to load folder:", err);
      } finally {
        setBrowsing(false);
        e.target.value = "";
      }
    },
    [onAddProject],
  );

  // Build trigger label
  const activeProject = projects[activeIndex];
  const triggerLabel =
    activeProject?.type === "workspace"
      ? (() => {
          const folder = activeProject.folders[activeProject.activeFolder];
          return folder
            ? `${activeProject.name} / ${folder.name}`
            : activeProject.name;
        })()
      : activeProject?.name ?? "Project";

  return (
    <div data-caid="project-selector" className="relative inline-block" ref={dropdownRef}>
      {/* Hidden file input for native folder picker */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        // @ts-ignore
        webkitdirectory=""
        directory=""
        onChange={handleBrowse}
      />

      {/* Trigger */}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--brand-border)] rounded-[10px] bg-bg-surface text-[var(--brand-text)] text-sm font-semibold cursor-pointer transition-[background] duration-150 hover:bg-primary_hover"
        onClick={() => setOpen((p) => !p)}
        title="Switch project / folder"
      >
        <Folder size={14} />
        <span className="max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">{triggerLabel}</span>
        <ChevronDown size={12} className={cn("transition-transform duration-200", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[240px] bg-bg-surface border border-[var(--brand-border)] rounded-xl shadow-[0_8px_24px_var(--brand-shadow)] p-2 z-[var(--z-dropdown)]">
          <div className="text-xs font-bold uppercase tracking-[0.5px] text-tertiary px-2 pb-2 pt-1">Workspaces &amp; Folders</div>

          {projects.map((p, pi) =>
            p.type === "workspace" ? (
              /* ── Workspace group ── */
              <div key={`ws-${pi}`} className="mb-1">
                <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-0.5 text-xs font-bold text-tertiary uppercase tracking-[0.3px]">
                  <Folder size={14} className="shrink-0 text-brand-solid" />
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</span>
                  {projects.length > 1 && (
                    <button
                      type="button"
                      className="shrink-0 w-[22px] h-[22px] border-none rounded-md bg-transparent text-[var(--brand-muted-light)] cursor-pointer flex items-center justify-center p-0 transition-all duration-100 hover:bg-brand-solid hover:text-white"
                      onClick={() => onRemoveProject(pi)}
                      title="Remove workspace"
                      aria-label={`Remove ${p.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {p.folders.map((f, fi) => {
                  const isActive = pi === activeIndex && fi === p.activeFolder;
                  return (
                    <button
                      type="button"
                      key={`folder-${fi}`}
                      className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg border-none bg-transparent text-sm text-[var(--brand-text)] cursor-pointer text-left transition-[background] duration-100",
                        isActive ? "bg-[var(--brand-accent-light)] text-brand-solid font-semibold" : "hover:bg-primary_hover"
                      )}
                      onClick={() => {
                        onSelect(pi, fi);
                        setOpen(false);
                      }}
                    >
                      <span className="w-4 shrink-0" />
                      {isActive ? (
                        <Check size={14} className="shrink-0 text-brand-solid" />
                      ) : (
                        <ChevronRight size={12} className="shrink-0 text-tertiary" />
                      )}
                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {f.name}
                        <span className="text-[9px] font-normal text-[var(--brand-muted-light)] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-[3px]">
                          <FileInput size={10} className="shrink-0 opacity-60" />
                          {f.inputDir}
                          <Save size={10} className="shrink-0 opacity-60" />
                          {f.outputDir}
                        </span>
                      </span>
                      {p.folders.length > 1 && (
                        <button
                          type="button"
                          className="shrink-0 w-[22px] h-[22px] border-none rounded-md bg-transparent text-[var(--brand-muted-light)] cursor-pointer flex items-center justify-center p-0 transition-all duration-100 hover:bg-brand-solid hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFolder(pi, fi);
                          }}
                          title="Remove folder"
                          aria-label={`Remove ${f.name}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="my-0.5 mb-1 ml-6 px-2 py-1 text-xs border border-solid border-[var(--brand-border-hairline)] rounded-md text-tertiary bg-transparent cursor-pointer flex items-center gap-1 transition-all duration-150 hover:bg-primary_hover hover:text-[var(--brand-text)]"
                  onClick={() => {
                    openAddFolder(pi);
                  }}
                >
                  <Plus size={12} />
                  Add Folder
                </button>
              </div>
            ) : (
              /* ── Client project (flat item) ── */
              <button
                type="button"
                key={`client-${pi}`}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg border-none bg-transparent text-sm text-[var(--brand-text)] cursor-pointer text-left transition-[background] duration-100",
                  pi === activeIndex ? "bg-[var(--brand-accent-light)] text-brand-solid font-semibold" : "hover:bg-primary_hover"
                )}
                onClick={() => {
                  onSelect(pi);
                  setOpen(false);
                }}
              >
                <FolderOpen size={14} className={cn("shrink-0", pi === activeIndex ? "text-brand-solid" : "text-tertiary")} />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {p.name}
                  <span className="inline-block text-[8px] font-bold uppercase tracking-[0.3px] px-1 py-[1px] ml-1.5 rounded bg-primary_hover text-tertiary align-middle">local</span>
                </span>
                {pi === activeIndex && <Check size={14} className="shrink-0 text-brand-solid" />}
                {projects.length > 1 && (
                  <button
                    type="button"
                    className="shrink-0 w-[22px] h-[22px] border-none rounded-md bg-transparent text-[var(--brand-muted-light)] cursor-pointer flex items-center justify-center p-0 transition-all duration-100 hover:bg-brand-solid hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveProject(pi);
                    }}
                    title="Remove project"
                    aria-label={`Remove ${p.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </button>
            ),
          )}

          <div className="h-px bg-[var(--brand-border-hairline)] my-1.5" />

          {/* New Workspace */}
          <button
            type="button"
            className="flex items-center gap-2 w-full p-2 border border-dashed border-[var(--brand-border)] rounded-lg bg-transparent text-xs font-semibold text-tertiary cursor-pointer transition-all duration-150 hover:bg-primary_hover hover:text-[var(--brand-text)] hover:border-[var(--brand-muted-light)] disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => {
              setOpen(false);
              resetWsForm();
              setShowWorkspaceModal(true);
            }}
          >
            <Plus size={14} />
            New Workspace
          </button>

          {/* Browse Folder */}
          <button
            type="button"
            className="flex items-center gap-2 w-full p-2 border border-dashed border-[var(--brand-border)] rounded-lg bg-transparent text-xs font-semibold text-tertiary cursor-pointer transition-all duration-150 hover:bg-primary_hover hover:text-[var(--brand-text)] hover:border-[var(--brand-muted-light)] disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => {
              setOpen(false);
              fileInputRef.current?.click();
            }}
            disabled={browsing}
          >
            <FolderOpen size={14} />
            {browsing ? "Loading..." : "Browse Folder"}
          </button>
        </div>
      )}

      {/* ── New Workspace Modal ── */}
      {showWorkspaceModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/30 z-[var(--z-dropdown)] flex items-center justify-center" onClick={() => setShowWorkspaceModal(false)}>
            <div className="bg-bg-surface rounded-2xl p-6 max-w-[380px] w-[90%] shadow-[0_8px_32px_rgba(0,0,0,0.15)]" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold mb-1">New Workspace</h3>
              <p className="text-xs text-tertiary mb-4">
                Create a workspace with an initial screen folder.
              </p>

              <label className="block text-xs font-semibold text-[var(--brand-text)] mb-1 mt-3 first:mt-0">Workspace Name</label>
              <input
                className="w-full px-3 py-2 border border-[var(--brand-border)] rounded-lg text-sm text-[var(--brand-text)] bg-white outline-none transition-[border-color] duration-150 focus:border-brand-solid focus:shadow-[0_0_0_2px_var(--brand-accent-light)]"
                type="text"
                placeholder="e.g. MoneyKitty"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                autoFocus
              />

              <label className="block text-xs font-semibold text-[var(--brand-text)] mb-1 mt-3 first:mt-0">Folder Name</label>
              <input
                className="w-full px-3 py-2 border border-[var(--brand-border)] rounded-lg text-sm text-[var(--brand-text)] bg-white outline-none transition-[border-color] duration-150 focus:border-brand-solid focus:shadow-[0_0_0_2px_var(--brand-accent-light)]"
                type="text"
                placeholder="e.g. Main Screens"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />

              <label className="block text-xs font-semibold text-[var(--brand-text)] mb-1 mt-3 first:mt-0">Input Directory (golden specs)</label>
              <input
                className="w-full px-3 py-2 border border-[var(--brand-border)] rounded-lg text-sm text-[var(--brand-text)] bg-white outline-none transition-[border-color] duration-150 focus:border-brand-solid focus:shadow-[0_0_0_2px_var(--brand-accent-light)]"
                type="text"
                placeholder="e.g. ../../docs/moneykitty/design/golden/"
                value={inputDir}
                onChange={(e) => setInputDir(e.target.value)}
              />

              <label className="block text-xs font-semibold text-[var(--brand-text)] mb-1 mt-3 first:mt-0">
                Output Directory (captured PNGs)
              </label>
              <input
                className="w-full px-3 py-2 border border-[var(--brand-border)] rounded-lg text-sm text-[var(--brand-text)] bg-white outline-none transition-[border-color] duration-150 focus:border-brand-solid focus:shadow-[0_0_0_2px_var(--brand-accent-light)]"
                type="text"
                placeholder="Leave empty to use input directory"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
              />

              <div className="flex justify-end gap-2 mt-5">
                <Button
                  color="secondary"
                  size="sm"
                  onClick={() => setShowWorkspaceModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  onClick={handleNewWorkspace}
                  isDisabled={!wsName.trim() || !folderName.trim() || !inputDir.trim()}
                >
                  Create Workspace
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Add Folder Modal ── */}
      {showFolderModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/30 z-[var(--z-dropdown)] flex items-center justify-center" onClick={() => setShowFolderModal(false)}>
            <div className="bg-bg-surface rounded-2xl p-6 max-w-[380px] w-[90%] shadow-[0_8px_32px_rgba(0,0,0,0.15)]" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold mb-1">Add Folder</h3>
              <p className="text-xs text-tertiary mb-4">
                Add a screen folder to the workspace.
              </p>

              <label className="block text-xs font-semibold text-[var(--brand-text)] mb-1 mt-3 first:mt-0">Folder Name</label>
              <input
                className="w-full px-3 py-2 border border-[var(--brand-border)] rounded-lg text-sm text-[var(--brand-text)] bg-white outline-none transition-[border-color] duration-150 focus:border-brand-solid focus:shadow-[0_0_0_2px_var(--brand-accent-light)]"
                type="text"
                placeholder="e.g. Onboarding Screens"
                value={afName}
                onChange={(e) => setAfName(e.target.value)}
                autoFocus
              />

              <label className="block text-xs font-semibold text-[var(--brand-text)] mb-1 mt-3 first:mt-0">Input Directory (golden specs)</label>
              <input
                className="w-full px-3 py-2 border border-[var(--brand-border)] rounded-lg text-sm text-[var(--brand-text)] bg-white outline-none transition-[border-color] duration-150 focus:border-brand-solid focus:shadow-[0_0_0_2px_var(--brand-accent-light)]"
                type="text"
                placeholder="e.g. ../../docs/moneykitty/design/golden/onboarding/"
                value={afInputDir}
                onChange={(e) => setAfInputDir(e.target.value)}
              />

              <label className="block text-xs font-semibold text-[var(--brand-text)] mb-1 mt-3 first:mt-0">
                Output Directory (captured PNGs)
              </label>
              <input
                className="w-full px-3 py-2 border border-[var(--brand-border)] rounded-lg text-sm text-[var(--brand-text)] bg-white outline-none transition-[border-color] duration-150 focus:border-brand-solid focus:shadow-[0_0_0_2px_var(--brand-accent-light)]"
                type="text"
                placeholder="Leave empty to use input directory"
                value={afOutputDir}
                onChange={(e) => setAfOutputDir(e.target.value)}
              />

              <div className="flex justify-end gap-2 mt-5">
                <Button
                  color="secondary"
                  size="sm"
                  onClick={() => setShowFolderModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  onClick={handleAddFolder}
                  isDisabled={!afName.trim() || !afInputDir.trim()}
                >
                  Add Folder
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
