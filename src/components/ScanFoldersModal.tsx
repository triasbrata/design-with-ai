import { useEffect, useState, useCallback } from "react";
import { cn } from "../lib/cn";
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
    <div className="fixed inset-0 z-[var(--z-confirm-modal)] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg-surface rounded-[14px] p-6 max-w-[420px] w-[90%] shadow-[0_16px_48px_var(--brand-shadow-heavy)] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-[var(--brand-text)] flex items-center gap-2">
            <Search size={16} />
            Scan for projects
          </h3>
          <button type="button" className="flex items-center justify-center p-1 border-none rounded-md bg-transparent text-[var(--brand-muted)] cursor-pointer transition-[background] duration-150 hover:bg-[var(--brand-accent-light)] hover:text-brand-solid" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-tertiary text-sm">
            <Loader2 size={20} className="animate-[sf-spin_1s_linear_infinite]" />
            <span>Scanning folders...</span>
          </div>
        )}

        {error && <div className="p-3 bg-[var(--brand-accent-light)] text-brand-solid rounded-lg text-xs mb-3">{error}</div>}

        {!loading && !error && folders.length === 0 && (
          <div className="py-8 text-center text-tertiary text-sm">
            No golden spec folders found in the repository.
          </div>
        )}

        {!loading && !error && folders.length > 0 && (
          <>
            <div className="flex gap-1.5 mb-2">
              <button type="button" className="font-inherit text-xs font-semibold px-2.5 py-1 border border-[var(--brand-border)] rounded-md bg-bg-surface text-tertiary cursor-pointer transition-all duration-150 hover:bg-primary_hover hover:text-[var(--brand-text)]" onClick={selectAll}>
                Select All
              </button>
              <button type="button" className="font-inherit text-xs font-semibold px-2.5 py-1 border border-[var(--brand-border)] rounded-md bg-bg-surface text-tertiary cursor-pointer transition-all duration-150 hover:bg-primary_hover hover:text-[var(--brand-text)]" onClick={deselectAll}>
                Deselect All
              </button>
            </div>
            <div className="overflow-y-auto max-h-[260px] mb-3 flex flex-col gap-1">
              {folders.map((folder, i) => (
                <label
                  key={folder.path}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-[background] duration-150",
                    selected.has(i) ? "bg-[var(--brand-accent-light)]" : "hover:bg-primary_hover"
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-solid shrink-0 cursor-pointer"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-[var(--brand-text)]">{folder.name}</span>
                    <span className="block text-xs text-[var(--brand-muted-light)] whitespace-nowrap overflow-hidden text-ellipsis">{folder.path}</span>
                  </div>
                  <span className="text-xs font-semibold text-tertiary bg-primary_hover px-2 py-[2px] rounded-lg whitespace-nowrap shrink-0">{folder.screenCount} screens</span>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border-none font-inherit text-sm font-semibold cursor-pointer bg-primary_hover text-tertiary transition-[background] duration-150 hover:bg-[var(--brand-border)]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg border-none font-inherit text-sm font-semibold cursor-pointer bg-brand-solid text-white transition-[background] duration-150 hover:bg-brand-solid_hover disabled:opacity-50 disabled:cursor-default"
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
