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
      className="rounded-(--radius) border border-(--border) bg-(--surface-elevated) p-4 w-full max-w-xl"
    >
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-4 h-4 text-(--accent) shrink-0" />
          <h3 className="text-sm font-semibold text-(--text-primary)">{t("deepResearchPlan")}</h3>
        </div>
        <p className="text-sm text-(--text-secondary) line-clamp-2">{topic}</p>
      </div>

      {/* AI-generated plan content (collapsible) */}
      {planText && (
        <div className="mb-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-(--text-secondary) hover:text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) rounded-sm"
            aria-expanded={expanded}
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? t("collapse") : t("expand")}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  duration: DURATION.NORMAL,
                  ease: EASE.MOVE,
                }}
                className="overflow-hidden"
              >
                <div className="mt-2 text-sm text-(--text-secondary) prose prose-sm prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:text-xs [&_p]:text-xs [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h1]:font-semibold [&_h2]:font-medium [&_h3]:font-medium">
                  <ReactMarkdown>{planText}</ReactMarkdown>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onStop && (
          <button
            onClick={onStop}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-(--radius) border border-(--danger)/30 text-(--danger) hover:bg-(--danger)/10 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            <StopCircle className="w-3.5 h-3.5" />
            {t("deepResearchStop")}
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs rounded-(--radius) border border-(--control-border) bg-(--control-bg) text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            {t("deepResearchEditPlan")}
          </button>
        )}
        {onApprove && (
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs rounded-(--radius) bg-(--accent) text-white hover:opacity-90 transition-opacity disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            {t("deepResearchApprovePlan")}
          </button>
        )}
      </div>
    </motion.div>
  );
}
