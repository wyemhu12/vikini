// /app/features/chat/components/StreamingPhaseIndicator.tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Brain, Sparkles, Check } from "lucide-react";

export type StreamingPhase = "idle" | "connecting" | "thinking" | "generating" | "done";

interface StreamingPhaseIndicatorProps {
  phase: StreamingPhase;
  thinkingDuration?: number; // seconds
}

const phaseConfig = {
  connecting: {
    icon: Loader2,
    text: "Đang kết nối...",
    iconClass: "animate-spin",
  },
  thinking: {
    icon: Brain,
    text: "Đang suy nghĩ",
    iconClass: "animate-pulse",
  },
  generating: {
    icon: Sparkles,
    text: "Đang tạo phản hồi...",
    iconClass: "",
  },
  done: {
    icon: Check,
    text: "Hoàn tất",
    iconClass: "",
  },
} as const;

export const StreamingPhaseIndicator = React.memo(function StreamingPhaseIndicator({
  phase,
  thinkingDuration,
}: StreamingPhaseIndicatorProps) {
  if (phase === "idle") return null;

  const config = phaseConfig[phase];
  const Icon = config.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2 text-xs text-secondary px-2 py-1.5 rounded-lg bg-surface-muted/50"
      >
        <Icon className={`w-3 h-3 ${config.iconClass}`} />
        <span>
          {config.text}
          {phase === "thinking" && thinkingDuration !== undefined && (
            <span className="ml-1 tabular-nums">({thinkingDuration}s)</span>
          )}
        </span>
      </motion.div>
    </AnimatePresence>
  );
});

export default StreamingPhaseIndicator;
