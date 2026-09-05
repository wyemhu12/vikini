// /app/features/chat/components/BubbleAvatar.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { ModelAvatar } from "./ModelAvatar";

export interface BubbleAvatarProps {
  isBot: boolean;
  isLoading?: boolean;
  modelName?: string;
}

export const BubbleAvatar = React.memo(function BubbleAvatar({
  isBot,
  isLoading = false,
  modelName,
}: BubbleAvatarProps) {
  const { t } = useLanguage();

  return (
    <div
      className={`relative flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg border text-xs font-black tracking-tighter shadow-sm overflow-hidden transition-[border-color,background-color,box-shadow] duration-300 ${
        isBot
          ? isLoading
            ? "border-(--accent)/30 bg-(--accent)/10 shadow-[0_0_15px_rgba(var(--accent-rgb,59,130,246),0.1)]"
            : "border-(--border) bg-(--surface-elevated) text-(--text-primary)"
          : "border-(--accent)/20 bg-(--accent) text-(--accent-foreground)"
      }`}
    >
      {isBot ? (
        isLoading ? (
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
        ) : (
          <div
            className="scale-100 transition-transform group-hover:scale-110 flex items-center justify-center w-full h-full"
            title={modelName || "AI"}
          >
            <ModelAvatar modelName={modelName} />
          </div>
        )
      ) : (
        t("me") || "ME"
      )}
    </div>
  );
});

export default BubbleAvatar;
