interface ToastProps {
  message: string;
  visible: boolean;
  ok: boolean;
}

export function Toast({ message, visible, ok }: ToastProps) {
  return (
    <div className={`toast${visible ? ' show' : ''}${ok ? ' ok' : ' err'}`}>
      {message}
    </div>
  );
}
