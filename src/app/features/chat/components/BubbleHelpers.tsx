// ChatBubble helper components — extracted from ChatBubble.tsx
// Contains TypingDots, TypingCursor, ThinkingBlock animations

"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, Brain, Loader2 } from "lucide-react";
import {
  formatThinkingDuration,
  type ThinkingStatsSnapshot,
} from "@/lib/features/chat/thinkingStats";
import { DURATION, EASE, TRANSITION, reducedMotionTransition } from "@/lib/utils/motion";

// ============================================
// Typing Dots (loading animation)
// ============================================

export const TypingDots = React.memo(function TypingDots({ statusText }: { statusText?: string }) {
  return (
    <div className="typing-dots flex items-center gap-1.5 px-2 py-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 bg-(--accent) rounded-full" />
      ))}
      {statusText && (
        <span className="text-xs text-(--muted) font-medium ml-1.5">{statusText}</span>
      )}
    </div>
  );
});

// ============================================
// Typing Cursor (blinking during streaming)
// ============================================

export const TypingCursor = React.memo(function TypingCursor() {
  const shouldReduce = useReducedMotion();
  return (
    <motion.span
      initial={{ opacity: 1 }}
      animate={shouldReduce ? { opacity: 1 } : { opacity: [1, 0.3, 1] }}
      transition={reducedMotionTransition(shouldReduce, {
        repeat: Infinity,
        duration: DURATION.AMBIENT_CURSOR,
        ease: EASE.MOVE,
      })}
      className="inline-block whitespace-nowrap ml-1 align-middle w-0.5 h-4 bg-(--accent) rounded-sm"
      aria-hidden="true"
    />
  );
});

// ============================================
// Thinking Block (collapsible reasoning)
// ============================================

export const ThinkingBlock = React.memo(function ThinkingBlock({
  content,
  t,
  stats,
}: {
  content: string;
  t: (key: string) => string;
  stats?: ThinkingStatsSnapshot | null;
}) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content changes (while expanded)
  useEffect(() => {
    if (!isCollapsed && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isCollapsed]);

  const headerLabel = stats
    ? (stats.live ? t("thinkingLiveStats") : t("thinkingDoneStats"))
        .replace("{tokens}", stats.tokens.toLocaleString())
        .replace("{seconds}", formatThinkingDuration(stats.elapsedMs))
    : t("thinkingProcess") || "Thinking Process";

  return (
    <div className="mb-4 rounded-lg border border-(--line) overflow-hidden bg-(--raised)">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold text-(--muted) hover:text-(--text) hover:bg-(--raised-hover) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.98]"
      >
        <Brain className="w-3 h-3" />
        <span>{headerLabel}</span>
        <motion.div
          className="ml-auto"
          animate={{ rotate: isCollapsed ? -90 : 0 }}
          transition={TRANSITION.COLLAPSE}
        >
          <ChevronDown className="w-3 h-3 opacity-50" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={TRANSITION.COLLAPSE}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className="px-3 py-3 border-t border-(--line) text-sm text-(--muted) font-mono leading-relaxed bg-(--raised)/50 whitespace-pre-wrap max-h-96 overflow-y-auto"
            >
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================
// Partial / Interrupted Message Status Badges
// ============================================

export const PartialMessageStatusBadges = React.memo(function PartialMessageStatusBadges({
  status,
  isSaving,
  saveFailed,
  onRetrySave,
  t,
}: {
  status?: string;
  isSaving?: boolean;
  saveFailed?: boolean;
  onRetrySave?: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
          status === "error"
            ? "bg-(--danger)/10 text-(--danger) border border-(--danger)/20"
            : "bg-(--raised) text-(--muted) border border-(--line)"
        }`}
      >
        {status === "error" ? t("interrupted") : t("stopped")}
      </span>
      {isSaving && (
        <span className="text-(--muted) flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin text-(--accent)" />
          {t("saving")}
        </span>
      )}
      {saveFailed && (
        <button
          type="button"
          onClick={onRetrySave}
          className="text-(--danger) hover:underline flex items-center gap-1 cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) rounded"
        >
          {t("saveFailed")} ({t("retrySave")})
        </button>
      )}
    </div>
  );
});
