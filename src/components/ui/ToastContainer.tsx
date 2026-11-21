"use client";

import { useEffect } from "react";
import { useToastStore, type Toast } from "@/lib/store/toastStore";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  const pauseToast = useToastStore((s) => s.pauseToast);
  const resumeToast = useToastStore((s) => s.resumeToast);
  const setVisibilityPaused = useToastStore((s) => s.setVisibilityPaused);
  const { t } = useLanguage();

  useEffect(() => {
    const onVisibilityChange = () => {
      setVisibilityPaused(document.hidden);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      setVisibilityPaused(false);
    };
  }, [setVisibilityPaused]);

  return (
    <div
      className="fixed top-[calc(1rem+var(--sat,0px))] right-[calc(1rem+var(--sar,0px))] z-(--z-toast) flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-label={t("notifications")}
      aria-live="polite"
    >
      {toasts.map((item) => (
        <ToastItem
          key={item.id}
          toast={item}
          onRemove={removeToast}
          onPause={pauseToast}
          onResume={resumeToast}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

function ToastItem({ toast, onRemove, onPause, onResume }: ToastItemProps) {
  const { t } = useLanguage();
  const icons = {
    success: <CheckCircle aria-hidden className="w-5 h-5 shrink-0 text-(--success)" />,
    error: <AlertCircle aria-hidden className="w-5 h-5 shrink-0 text-(--danger)" />,
    info: <Info aria-hidden className="w-5 h-5 shrink-0 text-(--accent)" />,
    warning: <AlertTriangle aria-hidden className="w-5 h-5 shrink-0 text-(--warning)" />,
  };

  const borders = {
    success: "border-(--success)/40",
    error: "border-(--danger)/40",
    info: "border-(--accent)/40",
    warning: "border-(--warning)/40",
  };

  return (
    <div
      role="alert"
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id)}
      onFocus={() => onPause(toast.id)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          onResume(toast.id);
        }
      }}
      className={`toast-enter pointer-events-auto flex items-start gap-3 p-4 rounded-xl border bg-(--surface) text-(--text) shadow-(--shadow-elevated) w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] ${borders[toast.type]}`}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0 break-words text-sm font-medium leading-relaxed">
        {toast.message}
      </div>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        aria-label={t("dismissNotification")}
        className="mt-0.5 p-1 -mr-1 text-(--muted) hover:text-(--text) hover:bg-(--raised) transition-colors rounded-md focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
      >
        <X aria-hidden className="w-4 h-4" />
      </button>
    </div>
  );
}
