// /app/features/research/components/ResearchReportPanel.tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { DURATION, EASE } from "@/lib/utils/motion";
import type { ResearchSource } from "@/lib/features/research/types";

interface ResearchReportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  report: string;
  sources?: ResearchSource[];
}

export default function ResearchReportPanel({
  isOpen,
  onClose,
  title,
  report,
  sources,
}: ResearchReportPanelProps) {
  const { t } = useLanguage();

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
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              duration: DURATION.NORMAL,
              ease: EASE.ENTER,
            }}
            role="dialog"
            aria-label={t("deepResearchReport")}
            className="fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-(--surface-elevated) border-l border-(--border) shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-(--border) shrink-0">
              <h2 className="text-base font-semibold text-(--text-primary) line-clamp-1 pr-2">
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label={t("deepResearchClose")}
                className="shrink-0 p-1.5 rounded-md text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="chat-markdown-container chat-markdown w-full max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {report}
                </ReactMarkdown>
              </div>

              {/* Sources */}
              {sources && sources.length > 0 && (
                <div className="mt-6 pt-4 border-t border-(--border)">
                  <h3 className="text-sm font-semibold text-(--text-primary) mb-3">
                    {t("deepResearchContents")}
                  </h3>
                  <ul className="space-y-2">
                    {sources.map((source, idx) => (
                      <li key={idx}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-(--accent) hover:underline break-all focus-visible:ring-2 focus-visible:ring-(--ring) rounded-sm"
                        >
                          {source.title || source.url}
                        </a>
                        {source.snippet && (
                          <p className="text-xs text-(--text-secondary) mt-0.5 line-clamp-2">
                            {source.snippet}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
