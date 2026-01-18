"use client";

import { Trash2, X, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  t: Record<string, string>; // Translation object
}

export default function DeleteConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  t,
}: DeleteConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md border-0 bg-transparent shadow-none p-0 overflow-visible sm:max-w-md">
        <DialogTitle className="sr-only">{title || t.modalDeleteTitle}</DialogTitle>

        {/* Glow effect */}
        <div className="absolute inset-0 bg-linear-to-r from-red-500/20 to-orange-500/20 blur-3xl -z-10" />

        {/* Card */}
        <div className="relative bg-linear-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <DialogClose className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500">
            <X className="w-4 h-4 text-gray-400" />
            <span className="sr-only">Close</span>
          </DialogClose>

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
            <h2 className="text-2xl font-bold text-white text-center mb-6">
              {title || t.modalDeleteTitle}
            </h2>

            <div className="space-y-4 mb-6">
              {/* Warning */}
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-2">
                  <Trash2 className="w-5 h-5 text-red-400 mt-0.5" />
                  <div className="text-sm font-medium text-red-300">{t.modalDeleteWarning}</div>
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
                  <div className="text-sm text-gray-300">{t.modalDeleteConfirm}</div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition-all"
              >
                {t.cancel}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-3 px-4 bg-linear-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 rounded-lg text-white font-medium transition-all shadow-lg shadow-red-500/20"
              >
                {t.modalDeleteButton}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
