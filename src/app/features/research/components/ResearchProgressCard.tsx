// /app/features/research/components/ResearchProgressCard.tsx
"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  BarChart3,
  FileText,
  Loader2,
  Check,
  StopCircle,
  ChevronDown,
  Clock,
} from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { DURATION, EASE } from "@/lib/utils/motion";
import type { ResearchStep } from "@/lib/features/research/types";

interface ResearchProgressCardProps {
  currentStep?: ResearchStep;
  topic: string;
  onStop?: () => void;
  onShowThinking?: () => void;
  /** 'planning' = creating plan, 'executing' = performing research */
  phase?: "planning" | "executing";
  /** ISO timestamp of when the task started - drives the live elapsed timer */
  startedAt?: string;
  /** Number of web sources discovered so far (shown under the "searching" step) */
  sourceCount?: number;
}

/** Formats elapsed seconds as m:ss (e.g. 2:47) or h:mm:ss for long runs. */
function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Live elapsed-time counter. Ticks once per second from `startedAt`.
 * Self-contained so it never triggers re-renders of the parent poll loop.
 */
function useElapsedSeconds(startedAt?: string): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const startMs = new Date(startedAt).getTime();
    if (Number.isNaN(startMs)) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed((Date.now() - startMs) / 1000);
    tick(); // set immediately, don't wait 1s
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
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
  onShowThinking,
  phase = "executing",
  startedAt,
  sourceCount = 0,
}: ResearchProgressCardProps) {
  const { t } = useLanguage();
  const headerKey = phase === "planning" ? "deepResearchPlanning" : "deepResearchExecuting";
  const elapsed = useElapsedSeconds(startedAt);

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
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-(--text-primary) mb-1">{t(headerKey)}</h3>
          <p className="text-xs text-(--text-secondary) line-clamp-1">{topic}</p>
        </div>
        {startedAt && (
          <div
            className="flex items-center gap-1 shrink-0 text-xs font-medium text-(--text-secondary) tabular-nums"
            aria-label={t("deepResearchElapsed") || "Elapsed time"}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{formatElapsed(elapsed)}</span>
          </div>
        )}
      </div>

      {/* Initialization indicator - shown when agent hasn't produced any steps yet */}
      {!currentStep && (
        <div className="mb-3 flex items-center gap-2 px-1">
          <Loader2 className="w-3.5 h-3.5 text-(--accent) animate-spin" />
          <span className="text-xs text-(--text-secondary) animate-pulse">
            {phase === "executing"
              ? t("deepResearchExecutionInit") ||
                "Starting research agent... this may take 1-2 minutes"
              : t("deepResearchInitializing") || "Initializing agent..."}
          </span>
        </div>
      )}

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

              {/* Source count - only on the searching step once we've found any */}
              {step.key === "searching" && sourceCount > 0 && (
                <span className="ml-auto text-xs text-(--text-secondary) tabular-nums">
                  {sourceCount} {t("deepResearchSourcesFound") || "sources"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions at the bottom */}
      <div className="mt-4 pt-3 flex justify-between items-center border-t border-(--border)/50">
        {onShowThinking ? (
          <button
            onClick={onShowThinking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-(--accent) hover:text-(--accent-light) hover:bg-(--accent)/10 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-(--accent) animate-pulse" />
            {t("deepResearchShowThinking") || "Show thinking"}
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </button>
        ) : (
          <div /> // Spacer
        )}

        <div className="flex items-center gap-1.5 text-xs text-(--text-secondary) font-medium ml-auto">
          {onStop && (
            <button
              onClick={onStop}
              className="flex items-center gap-1 text-(--danger) hover:text-(--danger-hover) px-2 py-1 rounded-md hover:bg-(--danger)/10 transition-colors"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>{t("deepResearchStop") || "Stop research"}</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
