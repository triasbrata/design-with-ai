import { useEffect, useRef } from "react";
import { cn } from "../lib/cn";

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
    <div
      className="fixed inset-0 z-[var(--z-confirm-modal)] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-bg-surface rounded-[14px] p-6 max-w-[360px] w-[90%] shadow-[0_16px_48px_var(--brand-shadow-heavy)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="text-[15px] font-semibold text-[var(--brand-text)] mb-2">{title}</div>
        <div className="text-sm text-tertiary leading-relaxed mb-5 whitespace-pre-wrap">{message}</div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border-none font-inherit text-sm font-semibold cursor-pointer bg-primary_hover text-tertiary transition-[background] duration-150 hover:bg-[var(--brand-border)]"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={cn(
              "px-4 py-2 rounded-lg border-none font-inherit text-sm font-semibold cursor-pointer text-white transition-[background] duration-150",
              variant === "danger" ? "bg-brand-solid hover:bg-brand-solid_hover" : "bg-brand-solid hover:bg-brand-solid_hover"
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
