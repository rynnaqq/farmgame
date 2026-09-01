import React from 'react';
import { useUiStore } from '../state/uiStore';
import type { ToastItem, ToastType } from '../state/storeTypes';

export interface ToastRegionProps {
  className?: string;
}

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case 'success':
      return (
        <span className="text-base flex-shrink-0" role="img" aria-label="Success">
          ✅
        </span>
      );
    case 'error':
      return (
        <span className="text-base flex-shrink-0" role="img" aria-label="Error">
          ❌
        </span>
      );
    case 'warning':
      return (
        <span className="text-base flex-shrink-0" role="img" aria-label="Warning">
          ⚠️
        </span>
      );
    case 'info':
    default:
      return (
        <span className="text-base flex-shrink-0" role="img" aria-label="Info">
          ℹ️
        </span>
      );
  }
}

function getToastStyles(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'border-emerald-500/50 bg-emerald-950/90 text-emerald-100 shadow-emerald-950/50';
    case 'error':
      return 'border-rose-500/50 bg-rose-950/90 text-rose-100 shadow-rose-950/50';
    case 'warning':
      return 'border-amber-500/50 bg-amber-950/90 text-amber-100 shadow-amber-950/50';
    case 'info':
    default:
      return 'border-cyan-500/50 bg-slate-900/90 text-cyan-100 shadow-slate-950/50';
  }
}

export const ToastRegion: React.FC<ToastRegionProps> = ({ className = '' }) => {
  const toasts = useUiStore((state) => state.toasts);

  if (toasts.length === 0) {
    return null;
  }

  const handleDismiss = (id: string) => {
    useUiStore.getState().dismissToast(id);
  };

  return (
    <div
      data-testid="toast-region"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className={`fixed top-3 right-3 z-50 pointer-events-none flex flex-col items-end gap-2 max-w-sm w-full p-2 select-none ${className}`}
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
      }}
    >
      {toasts.map((toast: ToastItem) => {
        const typeStyle = getToastStyles(toast.type);

        return (
          <div
            key={toast.id}
            data-testid={`toast-item-${toast.id}`}
            role="status"
            className={`pointer-events-auto w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border backdrop-blur-md shadow-lg transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${typeStyle}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ToastIcon type={toast.type} />
              <span className="text-xs md:text-sm font-medium tracking-wide truncate">
                {toast.message}
              </span>
            </div>

            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => handleDismiss(toast.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
};
