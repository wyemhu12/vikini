// /app/features/chat/components/thinkingOptions.ts
import {
  type ThinkingLevel,
  getAvailableThinkingLevels,
  isStrataLocalThinkingModel,
} from "./hooks/useThinkingLevel";

export interface ThinkingOption {
  value: ThinkingLevel;
  label: string;
  hint?: string;
}

const LABEL_KEYS: Record<ThinkingLevel, string> = {
  off: "thinkingOff",
  minimal: "thinkingLevelMinimal",
  low: "thinkingLevelLow",
  medium: "thinkingLevelMedium",
  high: "thinkingLevelHigh",
};

/** Token budget shown next to each level for the local Strata model. */
const LOCAL_BUDGET_HINTS: Partial<Record<ThinkingLevel, string>> = {
  low: "4K",
  medium: "8K",
  high: "12K",
};

/**
 * Labelled thinking levels for a model. Values come from `getAvailableThinkingLevels`
 * (single source of truth), so the chip menu and the mobile sheet never drift apart.
 */
export function getThinkingOptions(model: string, t: (key: string) => string): ThinkingOption[] {
  const isLocal = isStrataLocalThinkingModel(model);
  return getAvailableThinkingLevels(model).map((value) => {
    const budget = isLocal ? LOCAL_BUDGET_HINTS[value] : undefined;
    return {
      value,
      label: t(LABEL_KEYS[value]),
      ...(budget
        ? { hint: (t("thinkingBudgetHint") || "≤ {n} tokens").replace("{n}", budget) }
        : {}),
    };
  });
}
