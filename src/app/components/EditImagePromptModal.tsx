"use client";

import { useState, useEffect } from "react";
import { PenTool, X, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

interface EditImagePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newPrompt: string) => void;
  initialPrompt: string;
}

export default function EditImagePromptModal({
  isOpen,
  onClose,
  onConfirm,
  initialPrompt,
}: EditImagePromptModalProps) {
  const { t } = useLanguage();
  const [prompt, setPrompt] = useState(initialPrompt);

  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        aria-describedby={undefined}
        className="max-w-lg border-0 bg-transparent shadow-none p-0 overflow-visible"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-(--soft) blur-3xl -z-10" />

        {/* Card */}
        <div className="relative bg-(--surface) backdrop-blur-xl border border-(--line) rounded-2xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <DialogClose
            type="button"
            aria-label={t("close")}
            className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-(--raised) hover:bg-(--raised-hover) border border-(--line) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            <X aria-hidden="true" className="w-4 h-4 text-(--muted)" />
          </DialogClose>

          {/* Header */}
          <div className="flex items-center gap-3 px-6 sm:px-8 pt-7 pb-4 border-b border-(--line) pr-14">
            <div className="relative bg-(--accent)/10 backdrop-blur-xl border border-(--accent)/30 rounded-full p-3 shrink-0">
              <PenTool aria-hidden="true" className="w-6 h-6 text-(--accent)" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold text-(--text)">
                {t("editImagePromptTitle")}
              </DialogTitle>
              <p className="text-sm text-(--muted)">{t("editImagePromptLabel")}</p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="edit-image-prompt-textarea"
                className="text-xs font-bold text-(--muted) ml-1"
              >
                {t("editImagePromptLabel")}
              </label>
              <Textarea
                id="edit-image-prompt-textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] bg-(--bg) border-(--line) focus:border-(--accent)/50 text-(--text) placeholder:text-(--faint) resize-none rounded-xl p-4 leading-relaxed"
                placeholder={t("editImagePromptPlaceholder")}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-(--raised) hover:bg-(--raised-hover) border border-(--line) rounded-xl text-(--text) font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => onConfirm(prompt)}
                disabled={!prompt.trim() || prompt === initialPrompt}
                className="flex-1 py-3 px-4 bg-(--accent) hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-(--on-accent) font-medium transition-[filter] shadow-lg flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <Sparkles aria-hidden="true" className="w-4 h-4" />
                <span>{t("editImagePromptSave")}</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
