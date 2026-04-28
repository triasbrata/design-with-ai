interface HelpModalProps {
  show: boolean;
  onClose: () => void;
}

export function HelpModal({ show, onClose }: HelpModalProps) {
  return (
    <div
      className={`modal-overlay${show ? ' show' : ''}`}
      onClick={onClose}
    >
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          &#10005;
        </button>
        <h3>Keyboard Shortcuts</h3>
        <div className="row"><span><kbd>&larr;</kbd> <kbd>&rarr;</kbd></span><span>Prev / Next screen</span></div>
        <div className="row"><span><kbd>\</kbd></span><span>Toggle drawer</span></div>
        <div className="row"><span><kbd>Esc</kbd></span><span>Back to start</span></div>
        <div className="row"><span>&#9776;</span><span>Burger menu (top-left)</span></div>
        <div className="row"><span>Next at end</span><span>&rarr; Summary page</span></div>
      </div>
    </div>
  );
}
