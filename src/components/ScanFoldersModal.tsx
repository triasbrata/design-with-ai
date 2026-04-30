import { useEffect, useState, useCallback } from "react";
import { Search, Check, X, Loader2 } from "./base/icons";

interface ScannedFolder {
  name: string;
  path: string;
  screenCount: number;
}

interface ScanFoldersModalProps {
  open: boolean;
  onClose: () => void;
  onAddFolders: (folders: { name: string; path: string }[]) => void;
}

export function ScanFoldersModal({ open, onClose, onAddFolders }: ScanFoldersModalProps) {
  const [folders, setFolders] = useState<ScannedFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Fetch scanned folders on mount
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);
    setFolders([]);
    setSelected(new Set());

    fetch("/api/scan-folders")
      .then((r) => r.json())
      .then((data) => {
        const list: ScannedFolder[] = data.folders || [];
        setFolders(list);
        // Auto-select all by default
        setSelected(new Set(list.map((_, i) => i)));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const toggle = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(folders.map((_, i) => i)));
  }, [folders]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleAdd = useCallback(() => {
    const selectedFolders = folders.filter((_, i) => selected.has(i));
    if (selectedFolders.length === 0) return;
    onAddFolders(selectedFolders.map((f) => ({ name: f.name, path: f.path })));
  }, [folders, selected, onAddFolders]);

  if (!open) return null;

  return (
    <div data-caid="scan-folders-modal" className="sf-overlay" onClick={onClose}>
      <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sf-header">
          <h3>
            <Search size={16} />
            Scan for projects
          </h3>
          <button className="ld-close-btn" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </div>

        {loading && (
          <div className="sf-loading">
            <Loader2 size={20} className="sf-spinner" />
            <span>Scanning folders...</span>
          </div>
        )}

        {error && <div className="sf-error">{error}</div>}

        {!loading && !error && folders.length === 0 && (
          <div className="sf-empty">
            No golden spec folders found in the repository.
          </div>
        )}

        {!loading && !error && folders.length > 0 && (
          <>
            <div className="sf-select-actions">
              <button className="sf-select-btn" onClick={selectAll}>
                Select All
              </button>
              <button className="sf-select-btn" onClick={deselectAll}>
                Deselect All
              </button>
            </div>
            <div className="sf-list">
              {folders.map((folder, i) => (
                <label
                  key={folder.path}
                  className={`sf-item${selected.has(i) ? " selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="sf-checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                  />
                  <div className="sf-item-content">
                    <span className="sf-name">{folder.name}</span>
                    <span className="sf-path">{folder.path}</span>
                  </div>
                  <span className="sf-count">{folder.screenCount} screens</span>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="sf-actions">
          <button className="cm-btn cm-btn-cancel" onClick={onClose}>
            Cancel
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
