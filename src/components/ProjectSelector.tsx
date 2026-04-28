import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Project, Metadata } from "../types";
import type { ClientFileEntry } from "../types";
import { Button } from "./base";
import { Check, Folder, FolderOpen, Plus, Trash2, ChevronDown } from "./base/icons";

interface ProjectSelectorProps {
  projects: Project[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: (project: Project) => void;
  onRemove: (index: number) => void;
}

export function ProjectSelector({
  projects,
  activeIndex,
  onSelect,
  onAdd,
  onRemove,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDir, setAddDir] = useState("");
  const [browsing, setBrowsing] = useState(false);
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

  function handleAdd() {
    const name = addName.trim();
    const dir = addDir.trim();
    if (!name || !dir) return;
    onAdd({ type: "server", name, dir });
    setAddName("");
    setAddDir("");
    setShowAdd(false);
  }

  // Handle folder selection via webkitdirectory input
  const handleBrowse = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setBrowsing(true);

      try {
        const fileArray = Array.from(files);

        // Find screen-metadata.json
        const metaFile = fileArray.find((f) => f.name === "screen-metadata.json");
        if (!metaFile) {
          console.warn("No screen-metadata.json found in selected folder");
          setBrowsing(false);
          return;
        }

        // Parse metadata
        const metaText = await metaFile.text();
        const metadata: Metadata = JSON.parse(metaText);

        // Create blob URLs for HTML files
        const entries: ClientFileEntry[] = [];
        const htmlFiles = fileArray.filter((f) => f.name.endsWith(".html"));
        for (const file of htmlFiles) {
          const blobUrl = URL.createObjectURL(file);
          entries.push({ name: file.name, blobUrl });
        }

        // Derive project name from folder name
        const firstFile = fileArray[0];
        const folderName = firstFile.webkitRelativePath.split("/")[0];
        const projectName = folderName
          .replace(/[_-]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        onAdd({
          type: "client",
          name: projectName,
          files: entries,
          metadata,
        });
      } catch (err) {
        console.error("Failed to load folder:", err);
      } finally {
        setBrowsing(false);
        // Reset input value so same folder can be re-selected
        e.target.value = "";
      }
    },
    [onAdd],
  );

  const activeProject = projects[activeIndex];

  return (
    <div className="ps-wrapper" ref={dropdownRef}>
      {/* Hidden file input for native folder picker */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        // @ts-ignore - webkitdirectory/directory not in TS lib types
        webkitdirectory=""
        directory=""
        onChange={handleBrowse}
      />

      {/* Trigger */}
      <button className="ps-trigger" onClick={() => setOpen((p) => !p)} title="Switch project">
        <Folder size={14} />
        <span className="ps-trigger-name">{activeProject?.name ?? "Project"}</span>
        <ChevronDown size={12} className={`ps-chevron${open ? " open" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="ps-dropdown">
          <div className="ps-header">Projects</div>

          {projects.map((p, i) => (
            <button
              key={`${p.name}-${i}`}
              className={`ps-item${i === activeIndex ? " active" : ""}`}
              onClick={() => {
                onSelect(i);
                setOpen(false);
              }}
            >
              <Folder size={14} className="ps-item-icon" />
              <span className="ps-item-name">
                {p.name}
                {p.type === "client" ? (
                  <span className="ps-item-badge">local</span>
                ) : null}
              </span>
              {i === activeIndex && <Check size={14} className="ps-item-check" />}
              {projects.length > 1 && (
                <button
                  className="ps-item-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(i);
                  }}
                  title="Remove project"
                  aria-label={`Remove ${p.name}`}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </button>
          ))}

          <div className="ps-divider" />

          <button
            className="ps-add-btn"
            onClick={() => {
              setOpen(false);
              setShowAdd(true);
            }}
          >
            <Plus size={14} />
            Add Project
          </button>

          <button
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

      {/* Add project modal — portaled to body to escape transform stacking context */}
      {showAdd &&
        createPortal(
          <div className="ps-overlay" onClick={() => setShowAdd(false)}>
            <div className="ps-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Add Project</h3>
              <p className="ps-modal-sub">Enter a name and the path to the golden spec directory.</p>

              <label className="ps-field-label">Project Name</label>
              <input
                className="ps-input"
                type="text"
                placeholder="e.g. MoneyKitty"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                autoFocus
              />

              <label className="ps-field-label">Directory Path</label>
              <input
                className="ps-input"
                type="text"
                placeholder='e.g. ../../docs/moneykitty/design/golden/'
                value={addDir}
                onChange={(e) => setAddDir(e.target.value)}
              />
              <p className="ps-hint">Relative to project root. Directory must contain screen-metadata.json.</p>

              <div className="ps-modal-actions">
                <Button color="secondary" size="sm" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button color="primary" size="sm" onClick={handleAdd} isDisabled={!addName.trim() || !addDir.trim()}>
                  Add Project
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
