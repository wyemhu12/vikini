"use client";

import { Shield, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelName: string | null;
}

export default function UpgradeModal({ isOpen, onClose, modelName }: UpgradeModalProps) {
  const { t } = useLanguage();
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        aria-describedby={undefined}
        className="max-w-md border-0 bg-transparent shadow-none p-0 overflow-visible sm:max-w-md"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-(--soft) blur-3xl -z-10" />

        {/* Card */}
        <div className="relative bg-(--surface) backdrop-blur-xl border border-(--line) rounded-2xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <DialogClose
            type="button"
            aria-label={t("close")}
            className="absolute top-4 right-4 p-2 rounded-lg bg-(--raised) hover:bg-(--raised-hover) border border-(--line) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            <X aria-hidden="true" className="w-4 h-4 text-(--muted)" />
          </DialogClose>

          {/* Icon */}
          <div className="flex justify-center pt-8 pb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-(--soft) blur-2xl rounded-full" />
              <div className="relative bg-(--soft) backdrop-blur-xl border border-(--accent)/30 rounded-full p-4">
                <Shield aria-hidden="true" className="w-10 h-10 text-(--accent)" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 pb-8">
            <DialogTitle className="text-2xl font-bold text-(--text) text-center mb-6">
              {t("modalUpgradeTitle")}
            </DialogTitle>

            <div className="space-y-4 mb-6">
              {/* Model info */}
              {modelName && (
                <div className="p-4 bg-(--soft) border border-(--accent)/30 rounded-xl">
                  <div className="text-sm font-medium text-(--accent) mb-1">
                    {t("modalUpgradeRequestedModel")}
                  </div>
                  <div className="text-(--text) font-semibold"> {modelName}</div>
                </div>
              )}

              {/* Message */}
              <div className="p-4 bg-(--warning)/10 border border-(--warning)/30 rounded-xl">
                <div className="text-sm text-(--text)">{t("modalUpgradeNoPermission")}</div>
              </div>

              {/* Action */}
              <div className="p-4 bg-(--success)/10 border border-(--success)/30 rounded-xl">
                <div className="text-sm text-(--text)">{t("modalUpgradeContactAdmin")}</div>
              </div>
            </div>

            {/* Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 bg-(--accent) hover:brightness-110 rounded-lg text-(--on-accent) font-medium transition-[filter] shadow-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              {t("modalUpgradeGotIt")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
