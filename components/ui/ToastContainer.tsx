"use client";

import { useToastStore, Toast } from "@/lib/store/toastStore";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
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
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  };

  const colors = {
    success: "bg-green-950/90 border-green-500/50 text-green-200",
    error: "bg-red-950/90 border-red-500/50 text-red-200",
    info: "bg-blue-950/90 border-blue-500/50 text-blue-200",
    warning: "bg-amber-950/90 border-amber-500/50 text-amber-200",
  };

  return (
    <motion.div
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
        className="mt-0.5 text-white/30 hover:text-white/60 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
