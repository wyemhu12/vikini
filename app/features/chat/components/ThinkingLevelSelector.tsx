// /app/features/chat/components/ThinkingLevelSelector.tsx
"use client";

import { useState } from "react";
import { ChevronDown, Check, Brain } from "lucide-react";
import { type ThinkingLevel, isGemini3FlashModel } from "./hooks/useThinkingLevel";

interface ThinkingLevelSelectorProps {
  thinkingLevel: ThinkingLevel;
  setThinkingLevel: (level: ThinkingLevel) => void;
  currentModel: string;
  t: Record<string, string>;
}

interface ThinkingOption {
  value: ThinkingLevel;
  label: string;
  description?: string;
  flashOnly?: boolean;
}

export default function ThinkingLevelSelector({
  thinkingLevel,
  setThinkingLevel,
  currentModel,
  t,
}: ThinkingLevelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isFlashModel = isGemini3FlashModel(currentModel);

  // Build options based on model
  const options: ThinkingOption[] = [
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
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 px-4 py-1.5 transition-all group text-(--text-primary) hover:bg-(--control-bg)"
        title={t.thinkingLevelTooltip}
      >
        <Brain className="w-3 h-3 text-(--text-secondary) md:hidden" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-(--text-secondary) group-hover:text-(--text-primary) transition-colors">
          {displayLabel}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-(--text-secondary) transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-[160px] bg-(--surface-muted) border border-(--border) rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setThinkingLevel(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-all text-left ${
                  thinkingLevel === option.value
                    ? "bg-(--control-bg-hover) text-(--text-primary)"
                    : "text-(--text-secondary) hover:bg-(--control-bg) hover:text-(--text-primary)"
                }`}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {option.label}
                </span>
                {thinkingLevel === option.value && (
                  <div className="bg-(--accent) rounded-full p-0.5">
                    <Check className="w-2.5 h-2.5 text-(--surface)" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
