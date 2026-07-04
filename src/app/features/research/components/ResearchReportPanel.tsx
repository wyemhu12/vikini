// /app/features/research/components/ResearchReportPanel.tsx
"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronDown,
  Lightbulb,
  Download,
  Copy,
  Check,
  FileText,
  MessageSquarePlus,
} from "lucide-react";
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
  /** Navigate to the conversation created by finalizeResearch */
  onCreateConversation?: () => void;
}

/** Extracts headings from markdown for ToC navigation. */
function extractHeadings(markdown: string): Array<{ id: string; text: string; level: number }> {
  const headings: Array<{ id: string; text: string; level: number }> = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/\*\*/g, "").replace(/\*/g, "").trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      headings.push({ id, text, level });
    }
  }
  return headings;
}

export default function ResearchReportPanel({
  isOpen,
  onClose,
  title,
  report,
  sources,
  onOpenThoughts,
  onCreateConversation,
}: ResearchReportPanelProps) {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const headings = useMemo(() => extractHeadings(report), [report]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!tocOpen && !exportOpen) return;
    const handleClick = () => {
      setTocOpen(false);
      setExportOpen(false);
    };
    // Delay to avoid closing on the same click that opened
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
    };
  }, [tocOpen, exportOpen]);

  // Helper to get domain for favicon
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  };

  // Scroll to heading
  const scrollToHeading = useCallback((id: string) => {
    setTocOpen(false);
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`[id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Export as Markdown file
  const exportMarkdown = useCallback(() => {
    setExportOpen(false);
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-${title.slice(0, 40).replace(/[^\w\s-]/g, "")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [report, title]);

  // Export as PDF (print)
  const exportPdf = useCallback(() => {
    setExportOpen(false);
    window.print();
  }, []);

  // Copy report to clipboard
  const copyReport = useCallback(async () => {
    setExportOpen(false);
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [report]);

  // Custom heading renderer that adds IDs for ToC navigation
  const headingRenderer = useMemo(
    () => ({
      h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
        const text = String(children || "");
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-");
        return (
          <h1 id={id} {...props}>
            {children}
          </h1>
        );
      },
      h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
        const text = String(children || "");
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-");
        return (
          <h2 id={id} {...props}>
            {children}
          </h2>
        );
      },
      h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
        const text = String(children || "");
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-");
        return (
          <h3 id={id} {...props}>
            {children}
          </h3>
        );
      },
    }),
    []
  );

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
            className="fixed top-0 right-0 z-50 h-full w-full max-w-5xl bg-(--surface-elevated) border-l border-(--border) shadow-2xl flex flex-col print:static print:max-w-none print:shadow-none print:border-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-(--border) shrink-0 bg-(--surface-elevated) print:hidden">
              <h2 className="text-sm font-medium text-(--text-secondary) line-clamp-1 pr-4 max-w-[40%] md:max-w-[50%]">
                {title}
              </h2>

              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 mr-2">
                  {/* ToC Button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTocOpen(!tocOpen);
                        setExportOpen(false);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) rounded-full transition-colors"
                    >
                      <span>{t("deepResearchContents")}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${tocOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {/* ToC Dropdown */}
                    <AnimatePresence>
                      {tocOpen && headings.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full right-0 mt-1 w-72 max-h-80 overflow-y-auto rounded-xl border border-(--border) bg-(--surface-elevated) shadow-lg z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-2">
                            <p className="px-2 py-1.5 text-[10px] uppercase tracking-wider font-bold text-(--text-secondary)">
                              {t("deepResearchTocTitle")}
                            </p>
                            {headings.map((h) => (
                              <button
                                key={h.id}
                                onClick={() => scrollToHeading(h.id)}
                                className="w-full text-left px-2 py-1.5 text-xs text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) rounded-lg transition-colors"
                                style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
                              >
                                {h.text}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Export Button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExportOpen(!exportOpen);
                        setTocOpen(false);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) rounded-full transition-colors"
                    >
                      <span>{t("deepResearchExport")}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${exportOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {/* Export Dropdown */}
                    <AnimatePresence>
                      {exportOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full right-0 mt-1 w-48 rounded-xl border border-(--border) bg-(--surface-elevated) shadow-lg z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-1.5">
                            <button
                              onClick={exportMarkdown}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) rounded-lg transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {t("deepResearchExportMarkdown")}
                            </button>
                            <button
                              onClick={exportPdf}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) rounded-lg transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {t("deepResearchExportPdf")}
                            </button>
                            <button
                              onClick={copyReport}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) rounded-lg transition-colors"
                            >
                              {copied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-(--accent)" />
                                  <span className="text-(--accent)">{t("deepResearchCopied")}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  {t("deepResearchCopyReport")}
                                </>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Create Conversation */}
                  {onCreateConversation && (
                    <button
                      onClick={onCreateConversation}
                      className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium bg-(--accent) text-white hover:bg-(--accent-hover) rounded-full transition-colors shadow-sm"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>{t("deepResearchCreateConversation")}</span>
                    </button>
                  )}
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
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 md:p-10 lg:px-16">
              <div className="max-w-3xl mx-auto w-full">
                <div className="chat-markdown-container chat-markdown w-full max-w-none text-lg md:text-xl leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={headingRenderer}
                  >
                    {report}
                  </ReactMarkdown>
                </div>

                {/* Sources Section */}
                {sources && sources.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-(--border)">
                    <h3 className="text-sm font-semibold text-(--text-primary) mb-4">
                      {t("deepResearchSources")}
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
                            className="group flex items-start gap-3 p-3 rounded-xl bg-(--surface) hover:bg-(--control-bg-hover) border border-(--border) hover:border-(--border-hover) transition-colors duration-200"
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
              <div className="p-4 border-t border-(--border) bg-(--surface-elevated) print:hidden">
                <div className="max-w-3xl mx-auto w-full">
                  <button
                    onClick={onOpenThoughts}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-(--border) hover:bg-(--control-bg-hover) text-(--text-primary) text-sm font-medium transition-colors shadow-sm"
                  >
                    <Lightbulb className="w-4 h-4 text-(--accent)" />
                    <span>{t("deepResearchShowThinking")}</span>
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
