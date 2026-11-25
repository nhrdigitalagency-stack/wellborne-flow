import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] no-print"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="flex items-start gap-3 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 shadow-md text-sm text-[#172D4D] dark:text-slate-100"
          >
            {toast.kind === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-[#16A36A] dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            {toast.kind === 'error' && (
              <AlertCircle className="w-4 h-4 text-[#DC4545] dark:text-red-400 shrink-0 mt-0.5" />
            )}
            {toast.kind === 'info' && (
              <Info className="w-4 h-4 text-[#3578C8] dark:text-blue-400 shrink-0 mt-0.5" />
            )}
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Fermer la notification"
              className="text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100 p-0.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans ToastProvider.');
  return ctx;
}
