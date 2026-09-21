import React from 'react';
import { ToastMessage } from '../types';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, BellRing } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  onClearAll?: () => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss, onClearAll }) => {
  if (toasts.length === 0) return null;

  const getToastStyles = (type: ToastMessage['type']) => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-rose-50 border-rose-300 text-rose-950',
          iconBg: 'bg-rose-600 text-white',
          badgeBg: 'bg-rose-200 text-rose-800',
          Icon: XCircle,
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-300 text-amber-950',
          iconBg: 'bg-amber-500 text-white',
          badgeBg: 'bg-amber-200 text-amber-900',
          Icon: AlertTriangle,
        };
      case 'success':
        return {
          bg: 'bg-emerald-50 border-emerald-300 text-emerald-950',
          iconBg: 'bg-emerald-600 text-white',
          badgeBg: 'bg-emerald-200 text-emerald-900',
          Icon: CheckCircle2,
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 border-blue-300 text-blue-950',
          iconBg: 'bg-blue-600 text-white',
          badgeBg: 'bg-blue-200 text-blue-900',
          Icon: Info,
        };
    }
  };

  return (
    <div className="fixed top-3 left-2 right-2 sm:left-auto sm:right-4 z-50 flex flex-col gap-2.5 max-w-sm w-auto sm:w-full pointer-events-none">
      {toasts.length > 1 && onClearAll && (
        <div className="flex justify-end pointer-events-auto">
          <button
            onClick={onClearAll}
            className="text-[11px] font-medium bg-slate-900/90 hover:bg-slate-900 text-white px-2.5 py-1 rounded-md shadow-md backdrop-blur-sm transition"
          >
            Xóa tất cả ({toasts.length})
          </button>
        </div>
      )}

      {toasts.map((toast) => {
        const style = getToastStyles(toast.type);
        const IconComponent = style.Icon;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-3 ${style.bg}`}
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.iconBg} shadow-sm mt-0.5`}>
              <IconComponent className="h-4 w-4" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-xs font-bold leading-snug">{toast.title}</h4>
                {toast.deviceSn && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${style.badgeBg}`}>
                    {toast.deviceSn}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-700 mt-0.5 leading-relaxed break-words">
                {toast.message}
              </p>
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                {new Date(toast.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-700 rounded-md p-1 transition shrink-0"
              title="Đóng thông báo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
