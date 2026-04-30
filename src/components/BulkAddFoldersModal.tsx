import { useState, useEffect, useCallback } from "react";
import { Check, X } from "./base/icons";

export interface ScannedFolder {
  name: string;
  path: string;
  screenCount: number;
}

interface BulkAddFoldersModalProps {
  open: boolean;
  onClose: () => void;
  onAddFolders: (folders: { name: string; path: string }[]) => void;
  folders: ScannedFolder[];
  existingPaths: Set<string>;
}

export function BulkAddFoldersModal({
  open,
  onClose,
  onAddFolders,
  folders,
  existingPaths,
}: BulkAddFoldersModalProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Auto-select non-existing folders when modal opens
  useEffect(() => {
    if (open) {
      const initial = new Set<number>();
      folders.forEach((f, i) => {
        if (!existingPaths.has(f.path)) {
          initial.add(i);
        }
      });
      setSelected(initial);
    }
  }, [open, folders, existingPaths]);

  const toggle = useCallback(
    (idx: number) => {
      if (existingPaths.has(folders[idx].path)) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return next;
      });
    },
    [folders, existingPaths],
  );

  const handleAdd = useCallback(() => {
    const selectedFolders = folders.filter((_, i) => selected.has(i));
    if (selectedFolders.length === 0) return;
    onAddFolders(
      selectedFolders.map((f) => ({ name: f.name, path: f.path })),
    );
    onClose();
  }, [folders, selected, onAddFolders, onClose]);

  if (!open) return null;

  return (
    <div data-caid="bulk-add-folders-modal" className="sf-overlay" onClick={onClose}>
      <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sf-header">
          <h3>Related Golden Specs</h3>
          <button className="ld-close-btn" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </div>

        <p
          style={{
            fontSize: 12,
            color: "var(--brand-muted)",
            marginBottom: 12,
          }}
        >
          More golden spec folders were found nearby. Select which to add:
        </p>

        <div className="sf-list">
          {folders.map((folder, i) => {
            const isExisting = existingPaths.has(folder.path);
            return (
              <label
                key={folder.path}
                className={`sf-item${selected.has(i) ? " selected" : ""}${isExisting ? " existing" : ""}`}
                title={isExisting ? "Already in workspace" : undefined}
              >
                <input
                  type="checkbox"
                  className="sf-checkbox"
                  checked={selected.has(i)}
                  disabled={isExisting}
                  onChange={() => toggle(i)}
                />
                <div className="sf-item-content">
                  <span className="sf-name">{folder.name}</span>
                  <span className="sf-path">{folder.path}</span>
                </div>
                <span className="sf-count">{folder.screenCount} screens</span>
              </label>
            );
          })}
        </div>

        <div className="sf-actions">
          <button className="cm-btn cm-btn-cancel" onClick={onClose}>
            Skip
          </button>
          <button
            className="cm-btn cm-btn-confirm"
            onClick={handleAdd}
            disabled={selected.size === 0}
          >
            Add Selected ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
