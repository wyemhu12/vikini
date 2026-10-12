// /app/features/chat/components/hooks/useThinkingRegenerate.ts
"use client";

import { useCallback, useMemo } from "react";
import { toast } from "@/lib/store/toastStore";
import type { FrontendMessage } from "../../hooks/useConversation";
import { useThinkingLevel, getLowerThinkingLevel, type ThinkingLevel } from "./useThinkingLevel";

const LEVEL_KEY_MAP: Record<string, string> = {
  high: "thinkingLevelHigh",
  medium: "thinkingLevelMedium",
  low: "thinkingLevelLow",
  minimal: "thinkingLevelMinimal",
  off: "webSearchOff",
};

interface UseThinkingRegenerateOptions {
  currentModel: string;
  isStreaming: boolean;
  handleRegenerate: (message: FrontendMessage) => Promise<void>;
  t: (key: string) => string;
}

/** Thinking level preference (Gemini 3 Thinking models) plus "regenerate with lower thinking". */
export function useThinkingRegenerate({
  currentModel,
  isStreaming,
  handleRegenerate,
  t,
}: UseThinkingRegenerateOptions) {
  const { thinkingLevel, setThinkingLevel, availableLevels } = useThinkingLevel(currentModel);
  const lowerThinkingLevel = useMemo(
    () => getLowerThinkingLevel(thinkingLevel, availableLevels),
    [thinkingLevel, availableLevels]
  );

  const handleRegenerateWithLowerThinking = useCallback(
    (targetMessage: FrontendMessage, newLevel: ThinkingLevel) => {
      if (isStreaming) return;
      setThinkingLevel(newLevel);
      const levelLabel = t(LEVEL_KEY_MAP[newLevel] || "thinkingLevelLow");
      toast.info(t("regeneratingWithLowerThinking").replace("{level}", levelLabel));
      void handleRegenerate(targetMessage);
    },
    [isStreaming, setThinkingLevel, handleRegenerate, t]
  );

  return { thinkingLevel, setThinkingLevel, lowerThinkingLevel, handleRegenerateWithLowerThinking };
}
