// src/app/features/chat/components/EmptyReasoningNotice.tsx
"use client";

import React from "react";
import { RefreshCw, SlidersHorizontal, AlertCircle } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { ThinkingLevel } from "./hooks/useThinkingLevel";

export interface EmptyReasoningNoticeProps {
  reason?: "length" | "no_content";
  onRegenerate: () => void;
  onRegenerateLowerThinking?: () => void;
  lowerThinkingLevel?: ThinkingLevel | null;
}

export const EmptyReasoningNotice: React.FC<EmptyReasoningNoticeProps> = ({
  reason,
  onRegenerate,
  onRegenerateLowerThinking,
  lowerThinkingLevel,
}) => {
  const { t } = useLanguage();

  const isExhausted = reason === "length";
  const message = isExhausted ? t("thinkingExhaustedNotice") : t("thinkingNoResponseAlert");

  const canLowerThinking =
    Boolean(onRegenerateLowerThinking) &&
    lowerThinkingLevel !== null &&
    lowerThinkingLevel !== undefined;

  return (
    <div
      role="alert"
      className="mt-2 mb-1 p-3.5 rounded-xl border border-(--warning)/30 bg-(--warning)/5 backdrop-blur-xs text-(--text-primary) shadow-sm"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-(--warning) shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-xs leading-relaxed text-(--text-secondary)">{message}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-(--control-bg) hover:bg-(--control-bg-hover) text-(--text-primary) border border-(--control-border) transition-all active:scale-[0.98] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-(--accent)" />
              <span>{t("regenerate")}</span>
            </button>

            {canLowerThinking && (
              <button
                type="button"
                onClick={onRegenerateLowerThinking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-(--accent)/10 hover:bg-(--accent)/20 text-(--accent) border border-(--accent)/30 transition-all active:scale-[0.98] cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-(--accent)" />
                <span>{t("regenerateWithLowerThinking")}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
