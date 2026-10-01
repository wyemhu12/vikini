// /app/features/chat/components/BubbleAvatar.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { ModelAvatar } from "./ModelAvatar";
import { EASE, DURATION } from "@/lib/utils/motion";

export const BREATHING_CYCLE_DURATION = 2.0;

export interface BubbleAvatarProps {
  isBot: boolean;
  isLoading?: boolean;
  isStreaming?: boolean;
  isStreamThinking?: boolean;
  modelName?: string;
}

export const BubbleAvatar = React.memo(function BubbleAvatar({
  isBot,
  isLoading = false,
  isStreaming = false,
  isStreamThinking = false,
  modelName,
}: BubbleAvatarProps) {
  const { t } = useLanguage();

  const isActivelyThinking = Boolean(isStreaming && isStreamThinking);

  // 4-state Precedence: isLoading > (isStreaming && isStreamThinking) > isStreaming > idle
  const state: "loading" | "thinking" | "streaming" | "idle" = isLoading
    ? "loading"
    : isActivelyThinking
      ? "thinking"
      : isStreaming
        ? "streaming"
        : "idle";

  return (
    <div
      data-state={isBot ? state : undefined}
      className={`relative flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg border text-xs font-black tracking-tighter shadow-sm overflow-hidden transition-[border-color,background-color,box-shadow] duration-300 ${
        isBot
          ? isLoading
            ? "border-(--accent)/30 bg-(--accent)/10 shadow-[0_0_15px_rgba(var(--accent-rgb,59,130,246),0.1)]"
            : isActivelyThinking
              ? "border-(--accent)/40 bg-(--surface-elevated) text-(--text-primary) shadow-[0_0_15px_rgba(var(--accent-rgb,59,130,246),0.2)]"
              : isStreaming
                ? "border-(--accent)/30 bg-(--surface-elevated) text-(--text-primary)"
                : "border-(--border) bg-(--surface-elevated) text-(--text-primary)"
          : "border-(--accent)/20 bg-(--accent) text-(--accent-foreground)"
      }`}
    >
      {isBot ? (
        state === "loading" ? (
          <motion.div
            className="relative flex items-center justify-center w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="absolute inset-0 bg-(--accent)/10"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <Sparkles className="w-4 h-4 text-(--accent) z-10" />
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              <div className="w-full h-full rounded-lg border-2 border-transparent border-t-(--accent)/30 border-r-(--accent)/30" />
            </motion.div>
          </motion.div>
        ) : state === "thinking" ? (
          <motion.div
            className="relative flex items-center justify-center w-full h-full"
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.85, 1, 0.85],
            }}
            transition={{
              duration: BREATHING_CYCLE_DURATION,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            title={modelName || "AI"}
          >
            <motion.div
              className="absolute inset-0 rounded-lg bg-(--accent)/15"
              animate={{
                opacity: [0.3, 0.7, 0.3],
                scale: [0.95, 1.05, 0.95],
              }}
              transition={{
                duration: BREATHING_CYCLE_DURATION,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <div className="relative z-10 flex items-center justify-center scale-95">
              <ModelAvatar modelName={modelName} />
            </div>
          </motion.div>
        ) : state === "streaming" ? (
          <div
            className="relative flex items-center justify-center w-full h-full"
            title={modelName || "AI"}
          >
            <motion.div
              className="absolute inset-0 rounded-lg border border-(--accent)/40"
              animate={{
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: DURATION.NORMAL * 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <div className="relative z-10 flex items-center justify-center scale-95">
              <ModelAvatar modelName={modelName} />
            </div>
          </div>
        ) : (
          <motion.div
            className="scale-100 flex items-center justify-center w-full h-full"
            whileHover={{ scale: 1.08 }}
            transition={EASE.SPRING}
            title={modelName || "AI"}
          >
            <ModelAvatar modelName={modelName} />
          </motion.div>
        )
      ) : (
        t("me") || "ME"
      )}
    </div>
  );
});

export default BubbleAvatar;
