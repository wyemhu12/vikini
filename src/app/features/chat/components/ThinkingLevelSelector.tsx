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
  getEffectiveThinkingLevel,
} from "./hooks/useThinkingLevel";
import { getSupportedGeminiThinkingLevels } from "@/lib/core/modelRegistry";

interface ThinkingLevelSelectorProps {
  thinkingLevel: ThinkingLevel;
  setThinkingLevel: (level: ThinkingLevel) => void;
  currentModel: string;
}

interface ThinkingOption {
  value: ThinkingLevel;
  label: string;
}

export default function ThinkingLevelSelector({
  thinkingLevel,
  setThinkingLevel,
  currentModel,
}: ThinkingLevelSelectorProps) {
  const { t } = useLanguage();
  const isDeepSeek = isDeepSeekV4Model(currentModel);
  const isClaudeModel = isClaudeThinkingModel(currentModel);
  const isGemini3 = isGemini3Model(currentModel);
  const geminiSupported = isGemini3 ? getSupportedGeminiThinkingLevels(currentModel) : [];

  // Build options based on model
  // DeepSeek V4: off / low(=reasoning_effort:high) / high(=reasoning_effort:max)
  const options: ThinkingOption[] = isDeepSeek
    ? [
        { value: "off", label: t("webSearchOff") },
        { value: "low", label: t("thinkingLevelLow") || "STANDARD" },
        { value: "high", label: t("thinkingLevelHigh") || "DEEP" },
      ]
    : isClaudeModel
      ? [
          { value: "off", label: t("webSearchOff") },
          { value: "high", label: t("thinkingLevelHigh") || "HIGH" },
        ]
      : isGemini3 && geminiSupported.length > 0
        ? [
            { value: "off", label: t("webSearchOff") },
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
  const displayLabel = `${t("thinkingLevel") || "THINKING"}: ${currentOption.label}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("thinkingLevelTooltip")}
          className="flex items-center gap-1.5 rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 px-4 py-1.5 transition-colors group text-(--text-primary) hover:bg-(--control-bg)"
          title={t("thinkingLevelTooltip")}
        >
          <Brain className="w-3 h-3 text-(--text-secondary) md:hidden" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--text-secondary) group-hover:text-(--text-primary) transition-colors">
            {displayLabel}
          </span>
          <ChevronDown className="w-3 h-3 text-(--text-secondary) transition-transform" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" sideOffset={8} className="min-w-[160px]">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => setThinkingLevel(option.value)}
            className={`flex items-center justify-between gap-3 ${
              effectiveLevel === option.value ? "bg-(--control-bg-hover) text-(--text-primary)" : ""
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">{option.label}</span>
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
