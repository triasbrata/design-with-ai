import { useState, useCallback, useRef } from 'react';

interface ToastState {
  message: string;
  ok: boolean;
  visible: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({ message: '', ok: true, visible: false });
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((message: string, ok = true) => {
    clearTimeout(timer.current);
    setToast({ message, ok, visible: true });
    timer.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 2200);
  }, []);

  return { toast, show };
}
