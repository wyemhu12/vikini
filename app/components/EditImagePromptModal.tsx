"use client";

import { useState, useEffect } from "react";
import { PenTool, X, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface EditImagePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newPrompt: string) => void;
  initialPrompt: string;
  t: Record<string, string>;
}

export default function EditImagePromptModal({
  isOpen,
  onClose,
  onConfirm,
  initialPrompt,
  t,
}: EditImagePromptModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt);

  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border-0 bg-transparent shadow-none p-0 overflow-visible">
        <DialogTitle className="sr-only">{t.editGem || "Edit Prompt"}</DialogTitle>

        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl -z-10" />

        {/* Card */}
        <div className="relative bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <DialogClose className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
            <X className="w-4 h-4 text-gray-400" />
            <span className="sr-only">Close</span>
          </DialogClose>

          {/* Header */}
          <div className="flex items-center gap-3 px-8 pt-8 pb-4 border-b border-white/5">
            <div className="relative bg-blue-500/10 backdrop-blur-xl border border-blue-500/30 rounded-full p-3">
              <PenTool className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t.edit || "Edit Prompt"}</h2>
              <p className="text-sm text-gray-400">Refine your prompt for better results</p>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">
                Prompt
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] bg-black/40 border-white/10 focus:border-blue-500/50 text-gray-200 placeholder:text-gray-600 resize-none rounded-xl p-4 leading-relaxed"
                placeholder="Describe what you want to generate..."
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-all"
              >
                {t.cancel || "Cancel"}
              </button>
              <button
                onClick={() => onConfirm(prompt)}
                disabled={!prompt.trim() || prompt === initialPrompt}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t.regenerate || "Regenerate"}</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
