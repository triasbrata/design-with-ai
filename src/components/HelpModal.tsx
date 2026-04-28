import { X, ArrowLeft, ArrowRight, Menu } from "./base/icons";
import { Button } from "./base";

interface HelpModalProps {
  show: boolean;
  onClose: () => void;
}

export function HelpModal({ show, onClose }: HelpModalProps) {
  return (
    <div className={`modal-overlay${show ? " show" : ""}`} onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <Button
          color="link-gray"
          size="sm"
          onClick={onClose}
          iconLeading={<X size={18} />}
          style={{ float: "right", padding: 0 }}
          aria-label="Close"
        />
        <h3>Keyboard Shortcuts</h3>
        <div className="row">
          <span>
            <kbd>
              <ArrowLeft size={12} />
            </kbd>{" "}
            <kbd>
              <ArrowRight size={12} />
            </kbd>
          </span>
          <span>Prev / Next screen</span>
        </div>
        <div className="row">
          <span>
            <kbd>\</kbd>
          </span>
          <span>Toggle drawer</span>
        </div>
        <div className="row">
          <span>
            <kbd>Esc</kbd>
          </span>
          <span>Back to start</span>
        </div>
        <div className="row">
          <span>
            <kbd>
              <Menu size={12} />
            </kbd>
          </span>
          <span>Burger menu (top-left)</span>
        </div>
        <div className="row">
          <span>Next at end</span>
          <span>&rarr; Summary page</span>
        </div>
      </div>
    </div>
  );
}
