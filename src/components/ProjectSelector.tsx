import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
    <div className="ps-wrapper" ref={dropdownRef}>
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
        className="ps-trigger"
        onClick={() => setOpen((p) => !p)}
        title="Switch project / folder"
      >
        <Folder size={14} />
        <span className="ps-trigger-name">{triggerLabel}</span>
        <ChevronDown size={12} className={`ps-chevron${open ? " open" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="ps-dropdown">
          <div className="ps-header">Workspaces &amp; Folders</div>

          {projects.map((p, pi) =>
            p.type === "workspace" ? (
              /* ── Workspace group ── */
              <div key={`ws-${pi}`} className="ps-ws-group">
                <div className="ps-ws-header">
                  <Folder size={14} className="ps-ws-icon" />
                  <span className="ps-ws-name">{p.name}</span>
                  {projects.length > 1 && (
                    <button
                      type="button"
                      className="ps-item-remove"
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
                      className={`ps-item${isActive ? " active" : ""}`}
                      onClick={() => {
                        onSelect(pi, fi);
                        setOpen(false);
                      }}
                    >
                      <span className="ps-item-indent" />
                      {isActive ? (
                        <Check size={14} className="ps-item-check" />
                      ) : (
                        <ChevronRight size={12} className="ps-item-icon" />
                      )}
                      <span className="ps-item-name">
                        {f.name}
                        <span className="ps-item-paths">
                          <FileInput size={10} />
                          {f.inputDir}
                          <Save size={10} />
                          {f.outputDir}
                        </span>
                      </span>
                      {p.folders.length > 1 && (
                        <button
                          type="button"
                          className="ps-item-remove"
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
                  className="ps-add-btn ps-add-btn-sub"
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
                className={`ps-item${pi === activeIndex ? " active" : ""}`}
                onClick={() => {
                  onSelect(pi);
                  setOpen(false);
                }}
              >
                <FolderOpen size={14} className="ps-item-icon" />
                <span className="ps-item-name">
                  {p.name}
                  <span className="ps-item-badge">local</span>
                </span>
                {pi === activeIndex && <Check size={14} className="ps-item-check" />}
                {projects.length > 1 && (
                  <button
                    type="button"
                    className="ps-item-remove"
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

          <div className="ps-divider" />

          {/* New Workspace */}
          <button
            type="button"
            className="ps-add-btn"
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
            className="ps-add-btn"
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
          <div className="ps-overlay" onClick={() => setShowWorkspaceModal(false)}>
            <div className="ps-modal" onClick={(e) => e.stopPropagation()}>
              <h3>New Workspace</h3>
              <p className="ps-modal-sub">
                Create a workspace with an initial screen folder.
              </p>

              <label className="ps-field-label">Workspace Name</label>
              <input
                className="ps-input"
                type="text"
                placeholder="e.g. MoneyKitty"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                autoFocus
              />

              <label className="ps-field-label">Folder Name</label>
              <input
                className="ps-input"
                type="text"
                placeholder="e.g. Main Screens"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />

              <label className="ps-field-label">Input Directory (golden specs)</label>
              <input
                className="ps-input"
                type="text"
                placeholder="e.g. ../../docs/moneykitty/design/golden/"
                value={inputDir}
                onChange={(e) => setInputDir(e.target.value)}
              />

              <label className="ps-field-label">
                Output Directory (captured PNGs)
              </label>
              <input
                className="ps-input"
                type="text"
                placeholder="Leave empty to use input directory"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
              />

              <div className="ps-modal-actions">
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
          <div className="ps-overlay" onClick={() => setShowFolderModal(false)}>
            <div className="ps-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Add Folder</h3>
              <p className="ps-modal-sub">
                Add a screen folder to the workspace.
              </p>

              <label className="ps-field-label">Folder Name</label>
              <input
                className="ps-input"
                type="text"
                placeholder="e.g. Onboarding Screens"
                value={afName}
                onChange={(e) => setAfName(e.target.value)}
                autoFocus
              />

              <label className="ps-field-label">Input Directory (golden specs)</label>
              <input
                className="ps-input"
                type="text"
                placeholder="e.g. ../../docs/moneykitty/design/golden/onboarding/"
                value={afInputDir}
                onChange={(e) => setAfInputDir(e.target.value)}
              />

              <label className="ps-field-label">
                Output Directory (captured PNGs)
              </label>
              <input
                className="ps-input"
                type="text"
                placeholder="Leave empty to use input directory"
                value={afOutputDir}
                onChange={(e) => setAfOutputDir(e.target.value)}
              />

              <div className="ps-modal-actions">
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
