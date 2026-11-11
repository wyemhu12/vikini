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
      <DialogContent className="max-w-lg border-0 bg-transparent shadow-none p-0 overflow-visible">
        <DialogTitle className="sr-only">{t("editGem")}</DialogTitle>

        {/* Glow effect */}
        <div className="absolute inset-0 bg-(--soft) blur-3xl -z-10" />

        {/* Card */}
        <div className="relative bg-(--surface) backdrop-blur-xl border border-(--line) rounded-2xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <DialogClose className="absolute top-4 right-4 p-2 rounded-lg bg-(--raised) hover:bg-(--raised) border border-(--line) transition-colors focus:outline-none focus:ring-2 focus:ring-(--accent)/40">
            <X className="w-4 h-4 text-(--muted)" />
            <span className="sr-only">Close</span>
          </DialogClose>

          {/* Header */}
          <div className="flex items-center gap-3 px-8 pt-8 pb-4 border-b border-(--line)">
            <div className="relative bg-(--accent)/10 backdrop-blur-xl border border-(--accent)/30 rounded-full p-3">
              <PenTool className="w-6 h-6 text-(--accent)" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-(--text)">{t("edit")}</h2>
              <p className="text-sm text-(--muted)">Refine your prompt for better results</p>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-(--muted) ml-1">Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] bg-(--bg) border-(--line) focus:border-(--accent)/50 text-(--text) placeholder:text-(--faint) resize-none rounded-xl p-4 leading-relaxed"
                placeholder="Describe what you want to generate..."
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-(--raised) hover:bg-(--raised) border border-(--line) rounded-xl text-(--text) font-medium transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => onConfirm(prompt)}
                disabled={!prompt.trim() || prompt === initialPrompt}
                className="flex-1 py-3 px-4 bg-(--accent) hover:from-(--accent) hover:to-(--accent) disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-(--text) font-medium transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t("regenerate")}</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
