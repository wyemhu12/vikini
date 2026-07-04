"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, Globe, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { DURATION, EASE } from "@/lib/utils/motion";
import type { ResearchThinkingSource } from "@/lib/features/research/types";

interface ResearchThinkingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  thinkingText?: string;
  sources?: ResearchThinkingSource[];
  /** Hide skeleton loader when task is complete */
  isCompleted?: boolean;
}

export default function ResearchThinkingPanel({
  isOpen,
  onClose,
  title,
  thinkingText,
  sources,
  isCompleted = false,
}: ResearchThinkingPanelProps) {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new thinking text arrives
  useEffect(() => {
    if (isOpen && thinkingText) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [thinkingText, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.FAST }}
            className="fixed inset-0 z-50 bg-(--overlay)"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-in panel */}
          <motion.aside
            ref={panelRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              duration: DURATION.NORMAL,
              ease: EASE.ENTER,
            }}
            role="dialog"
            aria-label={t("deepResearchShowThinking") || "Show thinking"}
            className="fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-(--surface-elevated) border-l border-(--border) shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-(--border) shrink-0 bg-(--surface)">
              <div className="flex items-center gap-3 overflow-hidden">
                <h2 className="text-base font-semibold text-(--text-primary) line-clamp-1">
                  {title}
                </h2>
                <div className="flex items-center gap-1 text-xs text-(--text-secondary) bg-(--surface-elevated) px-2 py-1 rounded-md shrink-0 border border-(--border)">
                  <span>{t("deepResearchShowThinking") || "Show thinking"}</span>
                  <ChevronDown className="w-3 h-3" />
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label={t("deepResearchClose")}
                className="shrink-0 ml-2 p-1.5 rounded-md text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {/* Thinking Markdown */}
              {thinkingText ? (
                <div className="chat-markdown-container chat-markdown w-full max-w-none text-(--text-secondary)">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {thinkingText}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-(--text-secondary) opacity-70">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">{t("deepResearchGeneratingThoughts")}</span>
                </div>
              )}

              <div ref={bottomRef} />

              {/* Skeleton loading below text (Gemini style) - hidden when complete */}
              {!isCompleted && (
                <div className="space-y-3 opacity-30 animate-pulse mt-4">
                  <div className="h-3 bg-(--border) rounded-full w-full"></div>
                  <div className="h-3 bg-(--border) rounded-full w-[90%]"></div>
                  <div className="h-3 bg-(--border) rounded-full w-[95%]"></div>
                  <div className="h-3 bg-(--border) rounded-full w-[80%]"></div>
                </div>
              )}

              {/* Searching Sources */}
              {sources && sources.length > 0 && (
                <div className="mt-8 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-[#4285F4]" />
                    <h3 className="text-sm font-semibold text-(--text-primary)">
                      {t("deepResearchResearchingWebsites") || "Researching websites..."}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-(--surface) hover:bg-(--control-bg-hover) border border-(--border) rounded-full transition-colors text-xs text-(--text-primary) max-w-[200px]"
                        title={source.title}
                      >
                        {source.favicon ? (
                          <img src={source.favicon} alt="" className="w-3 h-3 rounded-sm" />
                        ) : (
                          <Globe className="w-3 h-3 text-(--text-secondary) shrink-0" />
                        )}
                        <span className="truncate">{source.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
