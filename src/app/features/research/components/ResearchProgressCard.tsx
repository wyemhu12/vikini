// /app/features/research/components/ResearchProgressCard.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { Search, BarChart3, FileText, Loader2, Check, StopCircle } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { DURATION, EASE } from "@/lib/utils/motion";
import type { ResearchStep } from "@/lib/features/research/types";

interface ResearchProgressCardProps {
  currentStep?: ResearchStep;
  topic: string;
  onStop?: () => void;
  /** 'planning' = creating plan, 'executing' = performing research */
  phase?: "planning" | "executing";
}

interface StepConfig {
  key: ResearchStep;
  icon: typeof Search;
  labelKey: string;
}

const STEPS: StepConfig[] = [
  { key: "searching", icon: Search, labelKey: "deepResearchSearching" },
  { key: "analyzing", icon: BarChart3, labelKey: "deepResearchAnalyzing" },
  { key: "writing", icon: FileText, labelKey: "deepResearchWriting" },
];

const STEP_ORDER: Record<ResearchStep, number> = {
  searching: 0,
  analyzing: 1,
  writing: 2,
};

function getStepState(
  stepKey: ResearchStep,
  currentStep?: ResearchStep
): "completed" | "active" | "pending" {
  if (!currentStep) return "pending";
  const currentIdx = STEP_ORDER[currentStep];
  const stepIdx = STEP_ORDER[stepKey];
  if (stepIdx < currentIdx) return "completed";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

export default function ResearchProgressCard({
  currentStep,
  topic,
  onStop,
  phase = "executing",
}: ResearchProgressCardProps) {
  const { t } = useLanguage();
  const headerKey = phase === "planning" ? "deepResearchPlanning" : "deepResearchExecuting";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.ENTER }}
      className="rounded-(--radius) border border-(--border) bg-(--surface-elevated) p-4 w-full max-w-xl relative overflow-hidden"
    >
      {/* Subtle accent border glow */}
      <div className="absolute inset-0 rounded-(--radius) ring-1 ring-(--accent)/20 pointer-events-none" />

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-(--text-primary) mb-1">{t(headerKey)}</h3>
        <p className="text-xs text-(--text-secondary) line-clamp-1">{topic}</p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step) => {
          const state = getStepState(step.key, currentStep);
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-center gap-3">
              {/* Step icon / status */}
              <div className="relative shrink-0">
                {state === "completed" ? (
                  <div className="w-6 h-6 rounded-full bg-(--accent)/20 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-(--accent)" />
                  </div>
                ) : state === "active" ? (
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-6 h-6 rounded-full bg-(--accent)/20 flex items-center justify-center"
                  >
                    <Loader2 className="w-3.5 h-3.5 text-(--accent) animate-spin" />
                  </motion.div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-(--surface-muted) flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-(--text-secondary)/50" />
                  </div>
                )}
              </div>

              {/* Step label */}
              <span
                className={`text-sm transition-colors ${
                  state === "active"
                    ? "text-(--text-primary) font-medium"
                    : state === "completed"
                      ? "text-(--accent)"
                      : "text-(--text-secondary)/60"
                }`}
              >
                {t(step.labelKey)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer: time hint + stop */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-(--text-secondary)">⏱ {t("deepResearchReadyIn")}</p>
        {onStop && (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-(--radius) border border-(--danger)/30 text-(--danger) hover:bg-(--danger)/10 transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            <StopCircle className="w-3.5 h-3.5" />
            {t("deepResearchStop")}
          </button>
        )}
      </div>
    </motion.div>
  );
}
