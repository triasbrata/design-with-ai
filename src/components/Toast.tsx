import { cn } from "../lib/cn";

interface ToastProps {
  message: string;
  visible: boolean;
  ok: boolean;
}

export function Toast({ message, visible, ok }: ToastProps) {
  return (
    <div
      data-caid="toast"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[var(--z-toast)] text-white text-xs font-semibold px-5 py-2 rounded-[10px] opacity-0 transition-opacity duration-250 pointer-events-none",
        visible && "opacity-100",
      )}
      style={{ backgroundColor: ok ? 'var(--state-success-text)' : 'var(--brand-accent)' }}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
