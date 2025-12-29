"use client";

import { Trash2, X, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

export default function DeleteConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title = "Delete Conversation / Xóa cuộc hội thoại",
  message,
}: DeleteConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-full max-w-md">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 blur-3xl" />

        {/* Card */}
        <div className="relative bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>

          {/* Icon */}
          <div className="flex justify-center pt-8 pb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/30 blur-2xl rounded-full" />
              <div className="relative bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-full p-4">
                <AlertTriangle className="w-10 h-10 text-red-400" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 pb-8">
            <h2 className="text-2xl font-bold text-white text-center mb-2">{title}</h2>

            <div className="space-y-4 mb-6">
              {/* Warning */}
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-2 mb-2">
                  <Trash2 className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-red-300 mb-1">
                      This action cannot be undone
                    </div>
                    <div className="text-xs text-gray-400">Hành động này không thể hoàn tác</div>
                  </div>
                </div>
              </div>

              {/* Message */}
              {message && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="text-sm text-gray-300 text-center">{message}</div>
                </div>
              )}

              {/* Default message if none provided */}
              {!message && (
                <div className="p-4 bg-gray-500/10 border border-gray-500/30 rounded-xl">
                  <div className="text-sm text-gray-300 mb-2">
                    Are you sure you want to delete this conversation?
                  </div>
                  <div className="text-xs text-gray-400">
                    Bạn có chắc chắn muốn xóa cuộc hội thoại này?
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition-all"
              >
                Cancel / Hủy
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 rounded-lg text-white font-medium transition-all shadow-lg shadow-red-500/20"
              >
                Delete / Xóa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
