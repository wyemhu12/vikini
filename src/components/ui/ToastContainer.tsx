"use client";

import { useToastStore, Toast } from "@/lib/store/toastStore";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      className="fixed top-4 right-4 z-9999 flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-(--success)" />,
    error: <AlertCircle className="w-5 h-5 text-(--danger)" />,
    info: <Info className="w-5 h-5 text-(--accent)" />,
    warning: <AlertTriangle className="w-5 h-5 text-(--warning)" />,
  };

  const colors = {
    success: "bg-(--success)/10 border-(--success)/30 text-(--text-primary)",
    error: "bg-(--danger)/10 border-(--danger)/30 text-(--text-primary)",
    info: "bg-(--accent)/10 border-(--accent)/30 text-(--text-primary)",
    warning: "bg-(--warning)/10 border-(--warning)/30 text-(--text-primary)",
  };

  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      className={`
        pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl min-w-[300px] max-w-md
        ${colors[toast.type]}
      `}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</div>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        className="mt-0.5 text-(--text-secondary) hover:text-(--text-primary) transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
