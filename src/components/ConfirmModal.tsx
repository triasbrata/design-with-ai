import { useEffect, useRef } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div data-caid="confirm-modal" className="cm-overlay" onClick={onCancel}>
      <div className="cm-card" onClick={(e) => e.stopPropagation()}>
        <div className="cm-title">{title}</div>
        <div className="cm-message">{message}</div>
        <div className="cm-actions">
          <button className="cm-btn cm-btn-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={`cm-btn cm-btn-confirm${variant === "danger" ? " danger" : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
