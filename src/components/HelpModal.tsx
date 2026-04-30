import { X, ArrowLeft, ArrowRight, Menu } from "./base/icons";
import { Button } from "./base";
import { cn } from "../lib/cn";

interface HelpModalProps {
  show: boolean;
  onClose: () => void;
}

export function HelpModal({ show, onClose }: HelpModalProps) {
  return (
    <div className={cn("fixed inset-0 bg-black/30 z-[var(--z-modal)] hidden items-center justify-center", show && "flex")} onClick={onClose}>
      <div className="bg-bg-surface rounded-[16px] p-6 max-w-[340px] w-[90%] shadow-[0_8px_32px_rgba(0,0,0,0.15)]" onClick={(e) => e.stopPropagation()}>
        <Button
          color="link-gray"
          size="sm"
          onClick={onClose}
          iconLeading={<X size={18} />}
          style={{ float: "right", padding: 0 }}
          aria-label="Close"
        />
        <h3 className="text-[16px] mb-4 font-bold">Keyboard Shortcuts</h3>
        <div className="flex justify-between py-[6px] text-[13px]">
          <span>
            <kbd className="bg-primary_hover px-2 py-[2px] rounded-[6px] text-[11px] font-mono font-semibold">
              <ArrowLeft size={12} />
            </kbd>{" "}
            <kbd className="bg-primary_hover px-2 py-[2px] rounded-[6px] text-[11px] font-mono font-semibold">
              <ArrowRight size={12} />
            </kbd>
          </span>
          <span>Prev / Next screen</span>
        </div>
        <div className="flex justify-between py-[6px] text-[13px]">
          <span>
            <kbd className="bg-primary_hover px-2 py-[2px] rounded-[6px] text-[11px] font-mono font-semibold">\</kbd>
          </span>
          <span>Toggle drawer</span>
        </div>
        <div className="flex justify-between py-[6px] text-[13px]">
          <span>
            <kbd className="bg-primary_hover px-2 py-[2px] rounded-[6px] text-[11px] font-mono font-semibold">Esc</kbd>
          </span>
          <span>Back to start</span>
        </div>
        <div className="flex justify-between py-[6px] text-[13px]">
          <span>
            <kbd className="bg-primary_hover px-2 py-[2px] rounded-[6px] text-[11px] font-mono font-semibold">
              <Menu size={12} />
            </kbd>
          </span>
          <span>Burger menu (top-left)</span>
        </div>
        <div className="flex justify-between py-[6px] text-[13px]">
          <span>Next at end</span>
          <span>&rarr; Summary page</span>
        </div>
      </div>
    </div>
  );
}
