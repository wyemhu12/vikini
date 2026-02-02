"use client";

import { Shield, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelName: string | null;
  t: Record<string, string>; // Translation object
}

export default function UpgradeModal({ isOpen, onClose, modelName, t }: UpgradeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-0 bg-transparent shadow-none p-0 overflow-visible sm:max-w-md">
        <DialogTitle className="sr-only">{t.modalUpgradeTitle}</DialogTitle>

        {/* Glow effect */}
        <div className="absolute inset-0 bg-linear-to-r from-purple-500/20 to-blue-500/20 blur-3xl -z-10" />

        {/* Card */}
        <div className="relative bg-linear-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <DialogClose className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500">
            <X className="w-4 h-4 text-gray-400" />
            <span className="sr-only">Close</span>
          </DialogClose>

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
            <h2 className="text-2xl font-bold text-white text-center mb-6">
              {t.modalUpgradeTitle}
            </h2>

            <div className="space-y-4 mb-6">
              {/* Model info */}
              {modelName && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="text-sm font-medium text-blue-300 mb-1">
                    {t.modalUpgradeRequestedModel}
                  </div>
                  <div className="text-white font-semibold">🔒 {modelName}</div>
                </div>
              )}

              {/* Message */}
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <div className="text-sm text-gray-300">{t.modalUpgradeNoPermission}</div>
              </div>

              {/* Action */}
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="text-sm text-gray-300">{t.modalUpgradeContactAdmin}</div>
              </div>
            </div>

            {/* Button */}
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-linear-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-lg text-white font-medium transition-all shadow-lg shadow-purple-500/20"
            >
              {t.modalUpgradeGotIt}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
