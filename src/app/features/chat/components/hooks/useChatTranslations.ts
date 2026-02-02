// /app/features/chat/components/hooks/useChatTranslations.ts
"use client";

import { useMemo } from "react";
import { useLanguage } from "../../hooks/useLanguage";

// ============================================
// Translation Keys
// ============================================

const CHAT_TRANSLATION_KEYS = [
  "appName",
  "whitelist",
  "whitelistOnly",
  "landingMessage",
  "exploreGems",
  "signOut",
  "newChat",
  "send",
  "placeholder",
  "refresh",
  "deleteAll",
  "logout",
  "modelSelector",
  "selectModel",
  "currentModel",
  "modelSelectorProviders",
  "modelSelectorService",
  "modelCategoryReasoning",
  "modelCategoryLowLatency",
  "modelSelectorModelsSuffix",
  "modelSelectorAvailableLater",
  "appliedGem",
  "appliedGemNone",
  "webSearch",
  "webSearchOn",
  "webSearchOff",
  "aiDisclaimer",
  "loading",
  "noConversations",
  "uploadFile",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-3-flash",
  "gemini-3-pro",
  "modelDescClaudeHaiku",
  "modelDescClaudeSonnet",
  "alwaysSearch",
  "alwaysSearchTooltip",
  "modelDescFlash25",
  "modelDescPro25",
  "modelDescFlash3",
  "modelDescPro3",
  "blueprint",
  "amber",
  "indigo",
  "charcoal",
  "gold",
  "red",
  "rose",
  "gemsTitle",
  "myGems",
  "premadeGems",
  "createGem",
  "editGem",
  "deleteGem",
  "saveGem",
  "cancel",
  "select",
  "error",
  "success",
  "renameChat",
  "deleteConfirm",
  "thinking",
  "regenerate",
  "edit",
  "save",
  "copy",
  "copied",
  "modalUpgradeTitle",
  "modalUpgradeRequestedModel",
  "modalUpgradeNoPermission",
  "modalUpgradeContactAdmin",
  "modalUpgradeGotIt",
  "modalDeleteTitle",
  "modalDeleteWarning",
  "modalDeleteConfirm",
  "modalDeleteButton",
  "descSuggestionCode",
  "descSuggestionImage",
  "descSuggestionAnalyze",
  "descSuggestionChat",
  "descStatsTokenUsage",
  "descStatsNoData",
  "tokenLimitTitle",
  "tokenLimitError",
  "studioGeneratingStatus",
  // Thinking Level
  "thinkingLevel",
  "thinkingLevelHigh",
  "thinkingLevelMedium",
  "thinkingLevelLow",
  "thinkingLevelMinimal",
  "thinkingLevelTooltip",
] as const;

// ============================================
// Hook Implementation
// ============================================

/**
 * Custom hook that provides memoized translations for ChatApp.
 * Reduces the need to pass 87+ translation keys through props.
 */
export function useChatTranslations(): Record<string, string> {
  const { t: tRaw, language } = useLanguage();

  const translations = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of CHAT_TRANSLATION_KEYS) {
      result[key] = tRaw(key);
    }
    return result;
  }, [tRaw, language]);

  return translations;
}

/**
 * Re-export useLanguage for cases where raw t() is needed
 */
export { useLanguage };
