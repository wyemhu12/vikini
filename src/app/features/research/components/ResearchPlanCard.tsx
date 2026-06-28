// /app/features/research/components/ResearchPlanCard.tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { ClipboardList, ChevronDown, StopCircle } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { DURATION, EASE } from "@/lib/utils/motion";

interface ResearchPlanCardProps {
  topic: string;
  /** AI-generated plan text (markdown) from Gemini */
  planText: string | null;
  onEdit?: () => void;
  onApprove?: () => void;
  onStop?: () => void;
  isLoading?: boolean;
}

export default function ResearchPlanCard({
  topic,
  planText,
  onEdit,
  onApprove,
  onStop,
  isLoading = false,
}: ResearchPlanCardProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.ENTER }}
      className="w-full max-w-3xl overflow-hidden rounded-2xl border border-(--border) bg-(--surface-elevated)"
    >
      {/* Top Header Section */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-(--surface-hover) transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-(--accent)">
            <ClipboardList className="w-5 h-5" />
            <span className="text-sm font-medium">
              {t("deepResearchPlan") || "Kế hoạch nghiên cứu"}
            </span>
          </div>
          <p className="text-sm text-(--text-primary) font-medium line-clamp-1">{topic}</p>
        </div>
        <button
          className="p-1.5 rounded-full text-(--text-secondary) hover:bg-(--surface) hover:text-(--text-primary) transition-colors"
          aria-expanded={expanded}
        >
          <ChevronDown
            className={`w-5 h-5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Expandable Plan Content */}
      <AnimatePresence>
        {expanded && planText && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.MOVE }}
            className="border-t border-(--border)"
          >
            <div
              className="p-5 text-sm text-(--text-secondary) prose prose-sm prose-invert max-w-none 
              [&_ol]:relative [&_ol]:border-l-2 [&_ol]:border-(--border) [&_ol]:ml-2 [&_ol]:pl-4 [&_ol]:space-y-4 [&_ol]:my-4 [&_ol]:list-none
              [&_ol>li]:relative
              [&_ol>li::before]:content-[counter(step-counter)] [&_ol]:[counter-reset:step-counter] [&_ol>li]:[counter-increment:step-counter]
              [&_ol>li::before]:absolute [&_ol>li::before]:-left-[27px] [&_ol>li::before]:top-0 [&_ol>li::before]:flex [&_ol>li::before]:items-center [&_ol>li::before]:justify-center [&_ol>li::before]:w-6 [&_ol>li::before]:h-6 [&_ol>li::before]:rounded-full [&_ol>li::before]:bg-(--surface) [&_ol>li::before]:border-2 [&_ol>li::before]:border-(--border) [&_ol>li::before]:text-[11px] [&_ol>li::before]:font-bold [&_ol>li::before]:text-(--text-primary)
              [&_ul]:list-none [&_ul]:pl-1 [&_ul]:mt-2 [&_ul]:space-y-2
              [&_ul>li]:relative [&_ul>li]:pl-4
              [&_ul>li::before]:content-[''] [&_ul>li::before]:absolute [&_ul>li::before]:left-0 [&_ul>li::before]:top-2 [&_ul>li::before]:w-1.5 [&_ul>li::before]:h-1.5 [&_ul>li::before]:rounded-full [&_ul>li::before]:bg-(--text-tertiary)
              [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-(--text-primary) [&_h1]:mb-4
              [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-(--text-primary) [&_h2]:mt-4 [&_h2]:mb-2
              [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-(--text-primary) [&_h3]:mt-3 [&_h3]:mb-1
              [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3
              [&_strong]:font-semibold [&_strong]:text-(--text-primary)
            "
            >
              <ReactMarkdown>{planText}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Actions Row */}
      <div className="flex items-center justify-between p-4 border-t border-(--border) bg-(--surface)/30">
        <div className="text-xs font-medium text-(--text-secondary)">Sẵn sàng sau vài phút</div>
        <div className="flex items-center gap-2">
          {onStop && (
            <button
              onClick={onStop}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-(--danger)/30 text-(--danger) hover:bg-(--danger)/10 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <StopCircle className="w-3.5 h-3.5" />
              {t("deepResearchStop")}
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              disabled={isLoading}
              className="px-4 py-1.5 text-xs font-medium rounded-full border border-(--control-border) bg-transparent text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              {t("deepResearchEditPlan") || "Chỉnh sửa kế hoạch"}
            </button>
          )}
          {onApprove && (
            <button
              onClick={onApprove}
              disabled={isLoading}
              className="px-4 py-1.5 text-xs font-medium rounded-full bg-(--accent) text-white hover:opacity-90 transition-opacity disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              {t("deepResearchApprovePlan") || "Bắt đầu nghiên cứu"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
