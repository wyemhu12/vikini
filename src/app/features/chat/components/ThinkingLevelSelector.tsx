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
import { type ThinkingLevel, getEffectiveThinkingLevel } from "./hooks/useThinkingLevel";
import { getThinkingOptions } from "./thinkingOptions";
import { ComposerChip } from "./ComposerChip";

interface ThinkingLevelSelectorProps {
  thinkingLevel: ThinkingLevel;
  setThinkingLevel: (level: ThinkingLevel) => void;
  currentModel: string;
  expandDown?: boolean;
}

/**
 * Desktop "Suy luận: Vừa" chip. On mobile the level is picked inside the composer
 * options sheet, so the chip is hidden below `md`.
 */
export default function ThinkingLevelSelector({
  thinkingLevel,
  setThinkingLevel,
  currentModel,
  expandDown = false,
}: ThinkingLevelSelectorProps) {
  const { t } = useLanguage();
  const options = getThinkingOptions(currentModel, t);
  if (options.length === 0) return null;

  const effectiveLevel = getEffectiveThinkingLevel(currentModel, thinkingLevel);
  const currentOption = options.find((o) => o.value === effectiveLevel) || options[0];
  const label = `${t("thinkingLevel")}: ${currentOption.label}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ComposerChip
          icon={Brain}
          active={effectiveLevel !== "off"}
          aria-label={label}
          title={t("thinkingLevelTooltip")}
          className="hidden min-w-0 shrink @3xl/chat:inline-flex"
        >
          <span className="max-w-[10rem] truncate">{label}</span>
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </ComposerChip>
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
              effectiveLevel === option.value ? "bg-(--raised) text-(--text)" : ""
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium">{option.label}</span>
              {option.hint && (
                <span className="text-xs font-normal text-(--muted)">({option.hint})</span>
              )}
            </span>
            {effectiveLevel === option.value && (
              <Check aria-hidden="true" className="h-4 w-4 text-(--accent)" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
