"use client";

import { Shield, X } from "lucide-react";
import { useEffect } from "react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelName: string | null;
}

export default function UpgradeModal({ isOpen, onClose, modelName }: UpgradeModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 blur-3xl" />

        {/* Card */}
        <div className="relative bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>

          {/* Icon */}
          <div className="flex justify-center pt-8 pb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/30 blur-2xl rounded-full" />
              <div className="relative bg-purple-500/10 backdrop-blur-xl border border-purple-500/30 rounded-full p-4">
                <Shield className="w-10 h-10 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 pb-8">
            <h2 className="text-2xl font-bold text-white text-center mb-2">
              Model Access Restricted
            </h2>
            <p className="text-lg text-purple-300 text-center mb-6">Mô hình bị hạn chế</p>

            <div className="space-y-4 mb-6">
              {/* Model info */}
              {modelName && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="text-sm font-medium text-blue-300 mb-1">
                    Requested Model / Mô hình yêu cầu
                  </div>
                  <div className="text-white font-semibold">🔒 {modelName}</div>
                </div>
              )}

              {/* Message */}
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <div className="text-sm text-gray-300 mb-2">
                  You don't have permission to use this model.
                </div>
                <div className="text-xs text-gray-400">Bạn không có quyền sử dụng mô hình này.</div>
              </div>

              {/* Action */}
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="text-sm text-gray-300 mb-2">
                  Please contact an administrator to upgrade your account.
                </div>
                <div className="text-xs text-gray-400">
                  Vui lòng liên hệ quản trị viên để nâng cấp tài khoản.
                </div>
              </div>
            </div>

            {/* Button */}
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-lg text-white font-medium transition-all shadow-lg shadow-purple-500/20"
            >
              Got It / Đã hiểu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
