import { useState, useEffect, useCallback } from "react";
import { X, Loader2 } from "./base/icons";
import type { GoldenDirResult } from "../hooks/useFileSystem";

interface ScanResultsModalProps {
  open: boolean;
  scanning: boolean;
  onClose: () => void;
  onAddFolders: (folders: GoldenDirResult[]) => void;
  onRetry?: () => void;
  folders: GoldenDirResult[];
  existingHandlePaths: Set<string>;
  skippedMalformed: number;
  skippedPermission: number;
  emptyHtmlCount: number;
  error: string | null;
  parentFolderName?: string;
  rootHandleId?: string;
}

export function ScanResultsModal({
  open,
  scanning,
  onClose,
  onAddFolders,
  onRetry,
  folders,
  existingHandlePaths,
  skippedMalformed,
  skippedPermission,
  emptyHtmlCount,
  error,
  parentFolderName,
  rootHandleId,
}: ScanResultsModalProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Auto-select non-existing folders when modal opens (not scanning, no error)
  useEffect(() => {
    if (open && !scanning && !error) {
      const initial = new Set<number>();
      folders.forEach((_, i) => {
        if (!isDuplicate(i)) {
          initial.add(i);
        }
      });
      setSelected(initial);
    }
  }, [open, scanning, error, folders, existingHandlePaths]);

  function isDuplicate(idx: number): boolean {
    const f = folders[idx];
    const key = `${rootHandleId}::${JSON.stringify(f.relativePath)}`;
    return existingHandlePaths.has(key);
  }

  const toggle = useCallback(
    (idx: number) => {
      if (isDuplicate(idx)) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return next;
      });
    },
    [folders, existingHandlePaths],
  );

  const handleSelectAll = useCallback(() => {
    const all = new Set<number>();
    folders.forEach((_, i) => {
      if (!isDuplicate(i)) all.add(i);
    });
    setSelected(all);
  }, [folders, existingHandlePaths]);

  const handleDeselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleAdd = useCallback(() => {
    const selectedFolders = folders.filter((_, i) => selected.has(i));
    if (selectedFolders.length === 0) return;
    onAddFolders(selectedFolders);
    onClose();
  }, [folders, selected, onAddFolders, onClose]);

  if (!open) return null;

  // ── Loading state ──
  if (scanning) {
    return (
      <div data-caid="scan-results-modal" className="sf-overlay" onClick={onClose}>
        <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
          <div className="sf-header">
            <h3>Golden Spec Folders</h3>
            <button className="ld-close-btn" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
          <div className="sf-loading">
            <Loader2 size={18} className="sf-spinner" />
            <span>Scanning folders...</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div data-caid="scan-results-modal" className="sf-overlay" onClick={onClose}>
        <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
          <div className="sf-header">
            <h3>Golden Spec Folders</h3>
            <button className="ld-close-btn" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
          <div className="sf-error">{error}</div>
          <div className="sf-actions">
            <button className="cm-btn cm-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            {onRetry && (
              <button className="cm-btn cm-btn-confirm" onClick={onRetry}>
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (folders.length === 0) {
    return (
      <div data-caid="scan-results-modal" className="sf-overlay" onClick={onClose}>
        <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
          <div className="sf-header">
            <h3>Golden Spec Folders</h3>
            <button className="ld-close-btn" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
          <div className="sf-empty">
            {parentFolderName ? (
              <>
                <p>
                  No golden spec folders found in the selected directory.
                </p>
              </>
            ) : (
              <p>No golden spec folders found in the selected directory.</p>
            )}
          </div>
          <div className="sf-actions">
            <button className="cm-btn cm-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            {onRetry && (
              <button className="cm-btn cm-btn-confirm" onClick={onRetry}>
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Results state ──
  const allDisabled = folders.every((_, i) => isDuplicate(i));
  const selectedCount = selected.size;

  // All-duplicates edge case
  if (allDisabled) {
    return (
      <div data-caid="scan-results-modal" className="sf-overlay" onClick={onClose}>
        <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
          <div className="sf-header">
            <h3>Golden Spec Folders</h3>
            <button className="ld-close-btn" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
          {parentFolderName && (
            <p
              style={{
                fontSize: 12,
                color: "var(--brand-muted)",
                marginBottom: 12,
              }}
            >
              Found in: &ldquo;{parentFolderName}&rdquo;
            </p>
          )}
          <div className="sf-empty">
            All folders are already in your workspace.
          </div>
          <div className="sf-actions">
            <button className="cm-btn cm-btn-cancel" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal results
  return (
    <div data-caid="scan-results-modal" className="sf-overlay" onClick={onClose}>
      <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sf-header">
          <h3>Golden Spec Folders</h3>
          <button className="ld-close-btn" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </div>

        {parentFolderName && (
          <p
            style={{
              fontSize: 12,
              color: "var(--brand-muted)",
              marginBottom: 12,
            }}
          >
            Found in: &ldquo;{parentFolderName}&rdquo;
          </p>
        )}

        {/* Warning banners */}
        {skippedMalformed > 0 && (
          <div className="sf-warning">
            Skipped {skippedMalformed} folder{skippedMalformed !== 1 ? "s" : ""} with invalid metadata.
          </div>
        )}
        {skippedPermission > 0 && (
          <div className="sf-warning">
            Skipped {skippedPermission} folder{skippedPermission !== 1 ? "s" : ""} (permission denied).
          </div>
        )}

        {/* Select / Deselect all */}
        <div className="sf-select-actions">
          <button className="sf-select-btn" onClick={handleSelectAll}>
            Select All
          </button>
          <button className="sf-select-btn" onClick={handleDeselectAll}>
            Deselect All
          </button>
        </div>

        {/* Folder list */}
        <div className="sf-list">
          {folders.map((folder, i) => {
            const existing = isDuplicate(i);
            return (
              <label
                key={folder.relativePath.join("/")}
                className={`sf-item${selected.has(i) ? " selected" : ""}${existing ? " existing" : ""}`}
                title={existing ? "Already in workspace" : undefined}
              >
                <input
                  type="checkbox"
                  className="sf-checkbox"
                  checked={selected.has(i)}
                  disabled={existing}
                  onChange={() => toggle(i)}
                />
                <div className="sf-item-content">
                  <span className="sf-name">{folder.name}</span>
                  <span className="sf-path">
                    {folder.relativePath.join(" / ")}
                  </span>
                </div>
                <span className="sf-count">{folder.screenCount} screens</span>
              </label>
            );
          })}
        </div>

        {/* Actions */}
        <div className="sf-actions">
          <button className="cm-btn cm-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="cm-btn cm-btn-confirm"
            onClick={handleAdd}
            disabled={selectedCount === 0}
          >
            Add Selected ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
}
