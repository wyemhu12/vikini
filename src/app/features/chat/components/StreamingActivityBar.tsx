"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Brain, Code2, FileText, Globe, Loader2, Sparkles, Terminal, Wrench } from "lucide-react";
import {
  formatElapsedDuration,
  formatLocalProgressText,
  formatStreamChars,
  isQuietStream,
  shouldShowActivityBar,
  type StreamActivity,
  type StreamActivityPhase,
} from "@/lib/features/chat/streamActivity";
import type { LocalStreamProgress } from "@/lib/features/chat/thinkingStats";
import { TRANSITION, reducedMotionTransition } from "@/lib/utils/motion";
import { useLanguage } from "../hooks/useLanguage";
import { TypingDots } from "./BubbleHelpers";

export interface StreamingActivityBarProps {
  activity: StreamActivity | null;
  localProgress?: LocalStreamProgress | null;
  isStreaming: boolean;
  hasDisplayContent: boolean;
}

function getPhaseIcon(phase: StreamActivityPhase, isQuiet: boolean): React.ReactNode {
  if (isQuiet && (phase === "responding" || phase === "connecting")) {
    return (
      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
    );
  }
  switch (phase) {
    case "code_writing":
      return <Code2 aria-hidden="true" className="h-3.5 w-3.5" />;
    case "code_running":
      return <Terminal aria-hidden="true" className="h-3.5 w-3.5" />;
    case "web_searching":
      return <Globe aria-hidden="true" className="h-3.5 w-3.5" />;
    case "web_fetching":
      return <FileText aria-hidden="true" className="h-3.5 w-3.5" />;
    case "thinking":
      return <Brain aria-hidden="true" className="h-3.5 w-3.5" />;
    case "tool_running":
      return <Wrench aria-hidden="true" className="h-3.5 w-3.5" />;
    case "local_queue":
    case "local_prompt":
      return <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />;
    default:
      return (
        <Loader2
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
        />
      );
  }
}

function getPhaseLabel(
  activity: StreamActivity,
  isQuiet: boolean,
  localProgress: LocalStreamProgress | null | undefined,
  t: (key: string) => string
): string {
  if (localProgress && (activity.phase === "local_queue" || activity.phase === "local_prompt")) {
    return formatLocalProgressText(localProgress, t) || t("streamActivityGenerating");
  }
  if (isQuiet && (activity.phase === "responding" || activity.phase === "connecting")) {
    return t("streamActivityStillWorking");
  }
  switch (activity.phase) {
    case "code_writing":
      return t("streamActivityWritingCode");
    case "code_running":
      return t("streamActivityRunningCode");
    case "web_searching":
      return t("streamActivitySearchingWeb");
    case "web_fetching":
      return t("streamActivityFetchingWeb");
    case "thinking":
      return t("streamActivityThinking");
    case "tool_running":
      return t("streamActivityRunningTool").replace("{tool}", activity.toolName || "tool");
    case "local_queue":
      return t("localLlmQueued").replace("{position}", String(activity.queuePosition ?? 1));
    case "local_prompt":
      return t("localPromptProgress").replace("{pct}", String(activity.promptPercent ?? 0));
    default:
      return t("streamActivityGenerating");
  }
}

export const StreamingActivityBar = React.memo(function StreamingActivityBar({
  activity,
  localProgress,
  isStreaming,
  hasDisplayContent,
}: StreamingActivityBarProps) {
  const { t } = useLanguage();
  const shouldReduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());

  const hasLocalProgress = Boolean(localProgress);
  const [fallbackStartedAt, setFallbackStartedAt] = useState(() => Date.now());

  useEffect(() => {
    if (hasLocalProgress) {
      setFallbackStartedAt(Date.now());
    }
  }, [hasLocalProgress]);

  const effectiveActivity = useMemo<StreamActivity | null>(() => {
    if (activity) return activity;
    if (!localProgress) return null;
    if (localProgress.type === "localQueue") {
      return {
        phase: "local_queue",
        queuePosition: localProgress.position,
        startedAt: fallbackStartedAt,
        updatedAt: fallbackStartedAt,
      };
    }
    const pct = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          ((localProgress.cache + localProgress.processed) / Math.max(1, localProgress.total)) * 100
        )
      )
    );
    return {
      phase: "local_prompt",
      promptPercent: pct,
      startedAt: fallbackStartedAt,
      updatedAt: fallbackStartedAt,
    };
  }, [activity, localProgress, fallbackStartedAt]);

  useEffect(() => {
    if (!isStreaming || !effectiveActivity) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isStreaming, effectiveActivity]);

  if (!isStreaming || !effectiveActivity) return null;

  const isQuiet = isQuietStream(effectiveActivity, now);
  if (!shouldShowActivityBar(effectiveActivity, now, hasDisplayContent)) {
    return null;
  }

  // Initial fast connect (< 8s, before any text/tool/local status): keep lightweight TypingDots inside single status region
  if (
    effectiveActivity.phase === "connecting" &&
    !hasDisplayContent &&
    !localProgress &&
    !isQuiet
  ) {
    return (
      <div role="status" aria-live="polite" aria-label={t("aiIsTyping")}>
        <TypingDots />
      </div>
    );
  }

  const label = getPhaseLabel(effectiveActivity, isQuiet, localProgress, t);
  const elapsedText = formatElapsedDuration(Math.max(0, now - effectiveActivity.startedAt));
  const showChars =
    (effectiveActivity.phase === "code_writing" || effectiveActivity.phase === "code_running") &&
    typeof effectiveActivity.chars === "number" &&
    effectiveActivity.chars > 0;
  const determinatePercent =
    effectiveActivity.phase === "local_prompt" ? effectiveActivity.promptPercent : undefined;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${effectiveActivity.phase}-${isQuiet ? "quiet" : "active"}`}
        role="status"
        aria-live="polite"
        data-testid="streaming-activity-bar"
        initial={shouldReduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduce ? { opacity: 0 } : { opacity: 0, y: -2 }}
        transition={reducedMotionTransition(shouldReduce, TRANSITION.FAST)}
        className="mt-3 w-full max-w-md overflow-hidden rounded-xl border border-(--line) bg-(--raised)/85 shadow-sm"
      >
        <div className="h-[2px] w-full overflow-hidden bg-(--line)/70" aria-hidden="true">
          {typeof determinatePercent === "number" ? (
            <motion.div
              className="h-full w-full origin-left bg-(--accent)"
              initial={false}
              animate={{
                transform: `scaleX(${Math.min(1, Math.max(0, determinatePercent / 100))})`,
              }}
              transition={reducedMotionTransition(shouldReduce, TRANSITION.EXIT_FAST)}
            />
          ) : (
            <div className="h-full w-2/5 rounded-full bg-(--accent) animate-vikini-shimmer motion-reduce:animate-none" />
          )}
        </div>

        <div className="flex items-center gap-2.5 px-3 py-2 text-xs">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-(--soft) text-(--accent)">
            {getPhaseIcon(effectiveActivity.phase, isQuiet)}
          </span>
          <span className="truncate font-medium text-(--text)">{label}</span>
          {showChars && (
            <span className="shrink-0 rounded-md bg-(--surface) px-1.5 py-0.5 font-mono text-xs text-(--muted) tabular-nums">
              {t("streamCharsUnit").replace("{count}", formatStreamChars(effectiveActivity.chars!))}
            </span>
          )}
          <span className="ml-auto shrink-0 font-mono text-xs text-(--muted) tabular-nums">
            {elapsedText}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

export default StreamingActivityBar;
