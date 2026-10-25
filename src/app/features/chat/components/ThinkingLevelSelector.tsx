// /app/features/chat/components/ThinkingLevelSelector.tsx
"use client";

import { Brain, Check, ChevronDown } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type ThinkingLevel,
  isGemini3Model,
  isDeepSeekV4Model,
  isClaudeThinkingModel,
  isStrataLocalThinkingModel,
  getEffectiveThinkingLevel,
} from "./hooks/useThinkingLevel";
import {
  getSupportedGeminiThinkingLevels,
  isGLMModel,
  isGemini4Model,
} from "@/lib/core/modelRegistry";

interface ThinkingLevelSelectorProps {
  thinkingLevel: ThinkingLevel;
  setThinkingLevel: (level: ThinkingLevel) => void;
  currentModel: string;
  expandDown?: boolean;
}

interface ThinkingOption {
  value: ThinkingLevel;
  label: string;
  hint?: string;
}

export default function ThinkingLevelSelector({
  thinkingLevel,
  setThinkingLevel,
  currentModel,
  expandDown = false,
}: ThinkingLevelSelectorProps) {
  const { t } = useLanguage();
  const isLocal = isStrataLocalThinkingModel(currentModel);
  const isDeepSeek = isDeepSeekV4Model(currentModel);
  const isClaudeModel = isClaudeThinkingModel(currentModel);
  const isGLM = isGLMModel(currentModel);
  const isGemini4 = isGemini4Model(currentModel);
  const isGemini3 = isGemini3Model(currentModel);
  const geminiSupported = isGemini3 ? getSupportedGeminiThinkingLevels(currentModel) : [];

  // Build options based on model
  // DeepSeek V4: off / low(=reasoning_effort:high) / high(=reasoning_effort:max)
  const options: ThinkingOption[] = isLocal
    ? [
        { value: "off", label: t("webSearchOff") },
        {
          value: "low",
          label: t("thinkingLevelLow") || "LOW",
          hint: (t("thinkingBudgetHint") || "≤ {n} tokens").replace("{n}", "4K"),
        },
        {
          value: "medium",
          label: t("thinkingLevelMedium") || "MEDIUM",
          hint: (t("thinkingBudgetHint") || "≤ {n} tokens").replace("{n}", "8K"),
        },
        {
          value: "high",
          label: t("thinkingLevelHigh") || "HIGH",
          hint: (t("thinkingBudgetHint") || "≤ {n} tokens").replace("{n}", "12K"),
        },
      ]
    : isDeepSeek
      ? [
          { value: "off", label: t("webSearchOff") },
          { value: "low", label: t("thinkingLevelLow") || "STANDARD" },
          { value: "high", label: t("thinkingLevelHigh") || "DEEP" },
        ]
      : isClaudeModel || isGLM
        ? [
            { value: "off", label: t("webSearchOff") },
            { value: "high", label: t("thinkingLevelHigh") || "HIGH" },
          ]
        : isGemini3 && geminiSupported.length > 0
          ? [
              ...(isGemini4 ? [] : [{ value: "off" as ThinkingLevel, label: t("webSearchOff") }]),
              ...geminiSupported.map((lvl) => ({
                value: lvl as ThinkingLevel,
                label:
                  lvl === "minimal"
                    ? t("thinkingLevelMinimal") || "MINIMAL"
                    : lvl === "low"
                      ? t("thinkingLevelLow") || "LOW"
                      : lvl === "medium"
                        ? t("thinkingLevelMedium") || "MEDIUM"
                        : t("thinkingLevelHigh") || "HIGH",
              })),
            ]
          : [
              { value: "off", label: t("webSearchOff") },
              { value: "low", label: t("thinkingLevelLow") || "LOW" },
              { value: "high", label: t("thinkingLevelHigh") || "HIGH" },
            ];

  const effectiveLevel = getEffectiveThinkingLevel(currentModel, thinkingLevel);
  const currentOption = options.find((o) => o.value === effectiveLevel) || options[0];
  const isThinkingActive = effectiveLevel !== "off";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t("thinkingLevel")}: ${currentOption.label}`}
          title={t("thinkingLevelTooltip")}
          className={`h-10 inline-flex items-center gap-1.5 rounded-full px-2.5 @sm/chat:px-3 text-xs font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.97] ${
            isThinkingActive
              ? "bg-(--accent)/15 text-(--accent) border border-(--accent)/30 hover:bg-(--accent)/25"
              : "text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary)"
          }`}
        >
          <Brain className="w-4 h-4 shrink-0" />
          <span className="hidden @sm/chat:inline">{currentOption.label}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={expandDown ? "bottom" : "top"}
        align="end"
        collisionPadding={8}
        sideOffset={8}
        className="min-w-[160px]"
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => setThinkingLevel(option.value)}
            className={`flex items-center justify-between gap-3 ${
              effectiveLevel === option.value ? "bg-(--control-bg-hover) text-(--text-primary)" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">{option.label}</span>
              {option.hint && (
                <span className="text-xs text-(--text-secondary) font-normal">({option.hint})</span>
              )}
            </div>
            {effectiveLevel === option.value && (
              <div className="bg-(--accent) rounded-full p-0.5">
                <Check className="w-2.5 h-2.5 text-(--surface)" />
              </div>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
