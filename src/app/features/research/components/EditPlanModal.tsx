// /app/features/research/components/EditPlanModal.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { DURATION, EASE } from "@/lib/utils/motion";

interface EditPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: string) => void;
}

export default function EditPlanModal({ isOpen, onClose, onSubmit }: EditPlanModalProps) {
  const { t } = useLanguage();
  const [feedback, setFeedback] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen) {
      setFeedback("");
      // Delay focus so the animation doesn't interfere
      const timer = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    const trimmed = feedback.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl+Enter to submit
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.FAST }}
            className="fixed inset-0 z-50 bg-(--overlay)"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.ENTER }}
            role="dialog"
            aria-label={t("deepResearchEditPlan")}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
          >
            <div className="w-full max-w-lg bg-(--surface-elevated) border border-(--border) rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-(--border)">
                <h3 className="text-sm font-semibold text-(--text-primary)">
                  {t("deepResearchEditPlan")}
                </h3>
                <button
                  onClick={onClose}
                  aria-label={t("deepResearchClose")}
                  className="p-1.5 rounded-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4">
                <p className="text-sm text-(--text-secondary) mb-3">
                  {t("deepResearchEditPlanPrompt")}
                </p>
                <textarea
                  ref={textareaRef}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={4}
                  maxLength={2000}
                  className="w-full px-3 py-2.5 rounded-(--radius) border border-(--control-border) bg-(--control-bg) text-(--text-primary) text-sm placeholder:text-(--text-secondary)/50 resize-none focus:outline-none focus:ring-2 focus:ring-(--ring) transition-shadow"
                  placeholder="..."
                />
                <p className="text-[10px] text-(--text-secondary)/60 mt-1.5 text-right">
                  {feedback.length}/2000
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-4 border-t border-(--border) bg-(--surface)/30">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium rounded-full border border-(--control-border) text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  {t("deepResearchClose")}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!feedback.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full bg-(--accent) text-white hover:opacity-90 transition-opacity disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  <Send className="w-3.5 h-3.5" />
                  {t("deepResearchApprovePlan")}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
