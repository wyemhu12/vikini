// /app/features/research/components/ResearchReportPanel.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { DURATION, EASE } from "@/lib/utils/motion";
import type { ResearchSource } from "@/lib/features/research/types";
import Image from "next/image";

interface ResearchReportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  report: string;
  sources?: ResearchSource[];
  onOpenThoughts?: () => void;
}

export default function ResearchReportPanel({
  isOpen,
  onClose,
  title,
  report,
  sources,
  onOpenThoughts,
}: ResearchReportPanelProps) {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Helper to get domain for favicon
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  };

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

          {/* Slide-in panel - Gemini style (Wider, dark elegant feel) */}
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
            aria-label={t("deepResearchReport")}
            className="fixed top-0 right-0 z-50 h-full w-full max-w-5xl bg-(--surface-elevated) border-l border-(--border) shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-(--border) shrink-0 bg-(--surface-elevated)">
              <h2 className="text-sm font-medium text-(--text-secondary) line-clamp-1 pr-4 max-w-[40%] md:max-w-[50%]">
                {title}
              </h2>

              <div className="flex items-center gap-2">
                {/* Dummy Action Buttons to match Gemini layout */}
                <div className="hidden md:flex items-center gap-2 mr-2">
                  <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) rounded-full transition-colors">
                    <span>Contents</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) rounded-full transition-colors">
                    <span>Share and export</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium bg-(--accent) text-white hover:bg-(--accent-hover) rounded-full transition-colors shadow-sm">
                    <span>Create</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="w-px h-5 bg-(--border) hidden md:block mx-1"></div>

                <button
                  onClick={onClose}
                  aria-label={t("deepResearchClose")}
                  className="shrink-0 p-2 rounded-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 md:p-10 lg:px-16">
              <div className="max-w-3xl mx-auto w-full">
                <div className="chat-markdown-container chat-markdown w-full max-w-none text-lg md:text-xl leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {report}
                  </ReactMarkdown>
                </div>

                {/* Sources Section */}
                {sources && sources.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-(--border)">
                    <h3 className="text-sm font-semibold text-(--text-primary) mb-4">
                      {t("deepResearchContents") || "Nguồn tham khảo"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sources.map((source, idx) => {
                        const domain = getDomain(source.url);
                        return (
                          <a
                            key={source.url || idx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start gap-3 p-3 rounded-xl bg-(--surface) hover:bg-(--control-bg-hover) border border-(--border) hover:border-(--border-hover) transition-all duration-200"
                          >
                            {/* Favicon */}
                            <div className="shrink-0 w-5 h-5 rounded-sm overflow-hidden bg-white mt-0.5">
                              {domain ? (
                                <Image
                                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                  alt={domain}
                                  width={20}
                                  height={20}
                                  className="w-full h-full object-contain"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full bg-(--control-bg-active)"></div>
                              )}
                            </div>

                            {/* Text Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-(--text-secondary) truncate mb-0.5 group-hover:text-(--text-primary) transition-colors">
                                {domain}
                              </p>
                              <p className="text-sm text-(--text-primary) font-medium line-clamp-2 leading-snug group-hover:text-(--accent) transition-colors">
                                {source.title || source.url}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer / Thoughts Button */}
            {onOpenThoughts && (
              <div className="p-4 border-t border-(--border) bg-(--surface-elevated)">
                <div className="max-w-3xl mx-auto w-full">
                  <button
                    onClick={onOpenThoughts}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-(--border) hover:bg-(--control-bg-hover) text-(--text-primary) text-sm font-medium transition-colors shadow-sm"
                  >
                    <Lightbulb className="w-4 h-4 text-(--accent)" />
                    <span>Thoughts</span>
                    <ChevronDown className="w-4 h-4 text-(--text-secondary)" />
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
