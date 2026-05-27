'use client';

import { useEffect, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'loading' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // ms, 0 = persist
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.duration === 0) return;
    const t = setTimeout(() => onDismiss(toast.id), toast.duration ?? 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  const icon =
    toast.type === 'success' ? '✓' :
    toast.type === 'error'   ? '✕' :
    toast.type === 'loading' ? '' :
    'ℹ';

  return (
    <div className={`toast ${toast.type}`} role="alert">
      {toast.type === 'loading' ? (
        <span className="spinner" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{icon}</span>
      )}
      <span>{toast.message}</span>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── Standalone hook ──────────────────────────────────────────────
let _toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = 'info', duration?: number): string => {
      const id = `toast-${++_toastId}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
      return id;
    },
    []
  );

  const success = useCallback((msg: string) => show(msg, 'success'), [show]);
  const error   = useCallback((msg: string) => show(msg, 'error', 5000), [show]);
  const loading = useCallback((msg: string) => show(msg, 'loading', 0), [show]);
  const info    = useCallback((msg: string) => show(msg, 'info'), [show]);

  return { toasts, dismiss, show, success, error, loading, info };
}
