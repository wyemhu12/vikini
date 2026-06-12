// /app/features/chat/components/ThinkingLevelSelector.tsx
"use client";

import { Brain, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type ThinkingLevel,
  isGemini3FlashModel,
  isDeepSeekV4Model,
} from "./hooks/useThinkingLevel";

interface ThinkingLevelSelectorProps {
  thinkingLevel: ThinkingLevel;
  setThinkingLevel: (level: ThinkingLevel) => void;
  currentModel: string;
  t: Record<string, string>;
}

interface ThinkingOption {
  value: ThinkingLevel;
  label: string;
  flashOnly?: boolean;
}

export default function ThinkingLevelSelector({
  thinkingLevel,
  setThinkingLevel,
  currentModel,
  t,
}: ThinkingLevelSelectorProps) {
  const isFlashModel = isGemini3FlashModel(currentModel);
  const isDeepSeek = isDeepSeekV4Model(currentModel);

  // Build options based on model
  // DeepSeek V4: off / low(=reasoning_effort:high) / high(=reasoning_effort:max)
  const options: ThinkingOption[] = isDeepSeek
    ? [
        { value: "off", label: t.webSearchOff || "OFF" },
        { value: "low", label: t.thinkingLevelLow || "STANDARD" },
        { value: "high", label: t.thinkingLevelHigh || "DEEP" },
      ]
    : [
        { value: "off", label: t.webSearchOff || "OFF" },
        ...(isFlashModel
          ? [
              {
                value: "minimal" as ThinkingLevel,
                label: t.thinkingLevelMinimal || "MINIMAL",
                flashOnly: true,
              },
            ]
          : []),
        { value: "low", label: t.thinkingLevelLow || "LOW" },
        ...(isFlashModel
          ? [
              {
                value: "medium" as ThinkingLevel,
                label: t.thinkingLevelMedium || "MEDIUM",
                flashOnly: true,
              },
            ]
          : []),
        { value: "high", label: t.thinkingLevelHigh || "HIGH" },
      ];

  const currentOption = options.find((o) => o.value === thinkingLevel) || options[0];
  const displayLabel = `${t.thinkingLevel || "THINKING"}: ${currentOption.label}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t.thinkingLevelTooltip || "Select thinking level"}
          className="flex items-center gap-1.5 rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 px-4 py-1.5 transition-all group text-(--text-primary) hover:bg-(--control-bg)"
          title={t.thinkingLevelTooltip}
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
              thinkingLevel === option.value ? "bg-(--control-bg-hover) text-(--text-primary)" : ""
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">{option.label}</span>
            {thinkingLevel === option.value && (
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
