// /app/features/research/components/ResearchPlanCard.tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, BarChart3, FileText, ChevronDown } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { DURATION, EASE } from "@/lib/utils/motion";
import type { ResearchPlan } from "@/lib/features/research/types";

interface ResearchPlanCardProps {
  topic: string;
  plan: ResearchPlan;
  onEdit?: () => void;
  onApprove?: () => void;
  isLoading?: boolean;
}

const PLAN_STEPS = [
  { icon: ClipboardList, labelKey: "deepResearchSearching" },
  { icon: BarChart3, labelKey: "deepResearchAnalyzing" },
  { icon: FileText, labelKey: "deepResearchWriting" },
] as const;

export default function ResearchPlanCard({
  topic,
  plan,
  onEdit,
  onApprove,
  isLoading = false,
}: ResearchPlanCardProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.ENTER }}
      className="rounded-(--radius) border border-(--border) bg-(--surface-elevated) p-4 w-full max-w-xl"
    >
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-(--text-primary) mb-1">
          {t("deepResearchPlan")}
        </h3>
        <p className="text-sm text-(--text-secondary) line-clamp-2">{topic}</p>
      </div>

      {/* Steps overview */}
      <div className="space-y-2 mb-3">
        {PLAN_STEPS.map((step) => (
          <div key={step.labelKey} className="flex items-center gap-2">
            <step.icon className="w-4 h-4 text-(--accent) shrink-0" />
            <span className="text-xs text-(--text-secondary)">{t(step.labelKey)}</span>
          </div>
        ))}
      </div>

      {/* Plan details (collapsible) */}
      {plan.steps.length > 0 && (
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
                <ul className="mt-2 space-y-1 pl-4 list-disc text-xs text-(--text-secondary)">
                  {plan.steps.map((step, idx) => (
                    <li key={`step-${idx}`}>{step}</li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Time estimate */}
      <p className="text-xs text-(--text-secondary) mb-4">⏱ {t("deepResearchReadyIn")}</p>

      {/* Actions */}
      <div className="flex items-center gap-2">
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
