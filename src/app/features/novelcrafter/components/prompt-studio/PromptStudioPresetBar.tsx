// /app/features/novelcrafter/components/prompt-studio/PromptStudioPresetBar.tsx
"use client";

import React, { useState } from "react";
import { ChevronDown, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  isBuiltInPresetId,
  NOVELCRAFTER_BUILT_IN_PRESET_IDS,
} from "@/lib/features/novelcrafter/promptStudioPresets";
import type { PromptStudioCustomPreset } from "@/lib/features/novelcrafter/promptStudioSettings";
import { FIELD_MAX_LENGTHS } from "@/lib/features/novelcrafter/stateLimits";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import { BUILT_IN_PRESET_LABELS } from "./promptStudioLabels";

interface PromptStudioPresetBarProps {
  activePresetId: string | null;
  customPresets: readonly PromptStudioCustomPreset[];
  onApplyPreset: (presetId: string) => void;
  onSaveAsPreset: (name: string) => boolean;
  onDeletePreset: (presetId: string) => void;
  onResetAll: () => void;
}

export default function PromptStudioPresetBar({
  activePresetId,
  customPresets,
  onApplyPreset,
  onSaveAsPreset,
  onDeletePreset,
  onResetAll,
}: PromptStudioPresetBarProps) {
  const { t } = useLanguage();
  const [selectedPresetId, setSelectedPresetId] = useState<string>(activePresetId || "default");
  const [newPresetName, setNewPresetName] = useState("");

  const effectiveSelected = activePresetId || selectedPresetId;
  const activeCustom = customPresets.find((p) => p.id === effectiveSelected);
  const isCustomSelected = Boolean(
    effectiveSelected && !isBuiltInPresetId(effectiveSelected) && activeCustom
  );

  const activePresetLabel = isBuiltInPresetId(effectiveSelected)
    ? t(BUILT_IN_PRESET_LABELS[effectiveSelected])
    : activeCustom?.name || t(BUILT_IN_PRESET_LABELS.default);

  const handleCreate = () => {
    if (onSaveAsPreset(newPresetName)) {
      setNewPresetName("");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-8 max-w-44 sm:max-w-56 min-w-0 shrink px-2.5 rounded-lg border border-(--line) bg-transparent hover:bg-(--raised) text-xs font-medium text-(--muted) hover:text-(--text) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
        >
          <span className="truncate">
            {t("novelcrafterPromptStudioPresetMenuBtn").replace("{preset}", activePresetLabel)}
          </span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(19rem,calc(100vw-2rem))] max-h-96 overflow-y-auto custom-scrollbar p-1.5"
      >
        <DropdownMenuLabel className="text-xs font-medium text-(--faint)">
          {t("novelcrafterPromptStudioPresetLabel")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={effectiveSelected}
          onValueChange={(id) => {
            setSelectedPresetId(id);
            onApplyPreset(id);
          }}
        >
          {NOVELCRAFTER_BUILT_IN_PRESET_IDS.map((id) => (
            <DropdownMenuRadioItem key={id} value={id} className="text-xs">
              {t(BUILT_IN_PRESET_LABELS[id])}
            </DropdownMenuRadioItem>
          ))}
          {customPresets.map((preset) => (
            <DropdownMenuRadioItem key={preset.id} value={preset.id} className="text-xs">
              {preset.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {isCustomSelected && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onDeletePreset(effectiveSelected)}
              className="text-xs text-(--danger) focus:text-(--danger)"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2 shrink-0" />
              <span>{t("novelcrafterPromptStudioPresetDelete")}</span>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <div
          className="px-1.5 py-1.5 flex items-center gap-1.5"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            maxLength={FIELD_MAX_LENGTHS.promptPresetName}
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder={t("novelcrafterPromptStudioPresetNamePlaceholder")}
            aria-label={t("novelcrafterPromptStudioPresetNamePlaceholder")}
            className="flex-1 min-w-0 h-8 rounded-md border border-(--line) bg-(--bg) px-2.5 text-xs text-(--text) placeholder:text-(--faint) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            aria-label={t("novelcrafterPromptStudioPresetSaveAs")}
            title={t("novelcrafterPromptStudioPresetSaveAs")}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-(--accent) text-(--on-accent) hover:brightness-110 transition-all focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onResetAll} className="text-xs text-(--muted)">
          <RotateCcw className="w-3.5 h-3.5 mr-2 shrink-0" />
          <span>{t("novelcrafterPromptStudioResetAll")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
