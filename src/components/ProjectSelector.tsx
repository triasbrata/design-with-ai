import { useState, useRef, useEffect } from "react";
import type { ProjectConfig } from "../types";
import { Button } from "./base";
import { Check, Folder, Plus, Trash2, ChevronDown } from "./base/icons";

interface ProjectSelectorProps {
  projects: ProjectConfig[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: (name: string, dir: string) => void;
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    onAdd(name, dir);
    setAddName("");
    setAddDir("");
    setShowAdd(false);
  }

  const activeProject = projects[activeIndex];

  return (
    <div className="ps-wrapper" ref={dropdownRef}>
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
              key={`${p.dir}-${i}`}
              className={`ps-item${i === activeIndex ? " active" : ""}`}
              onClick={() => {
                onSelect(i);
                setOpen(false);
              }}
            >
              <Folder size={14} className="ps-item-icon" />
              <span className="ps-item-name">{p.name}</span>
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
        </div>
      )}

      {/* Add project modal */}
      {showAdd && (
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
        </div>
      )}
    </div>
  );
}
