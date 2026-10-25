// /app/features/novelcrafter/components/prompt-studio/PromptStudioPresetBar.tsx
"use client";

import React, { useState } from "react";
import { RotateCcw, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import {
  isBuiltInPresetId,
  NOVELCRAFTER_BUILT_IN_PRESET_IDS,
} from "@/lib/features/novelcrafter/promptStudioPresets";
import type { PromptStudioCustomPreset } from "@/lib/features/novelcrafter/promptStudioSettings";
import { FIELD_MAX_LENGTHS } from "@/lib/features/novelcrafter/stateLimits";
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
  const isCustomSelected = Boolean(
    effectiveSelected &&
    !isBuiltInPresetId(effectiveSelected) &&
    customPresets.some((p) => p.id === effectiveSelected)
  );

  const handleCreate = () => {
    if (onSaveAsPreset(newPresetName)) {
      setNewPresetName("");
    }
  };

  return (
    <section className="rounded-2xl border border-(--border) bg-(--surface-elevated)/70 p-4 space-y-3 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <label
            htmlFor="prompt-studio-preset-select"
            className="inline-flex items-center gap-1.5 text-xs md:text-sm font-bold text-(--text-primary) shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4 text-(--accent)" />
            <span>{t("novelcrafterPromptStudioPresetLabel")}:</span>
          </label>
          <select
            id="prompt-studio-preset-select"
            value={effectiveSelected}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedPresetId(id);
              onApplyPreset(id);
            }}
            className="h-9 min-w-56 rounded-lg border border-(--control-border) bg-(--control-bg) px-3 text-xs md:text-sm font-medium text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            {NOVELCRAFTER_BUILT_IN_PRESET_IDS.map((id) => (
              <option key={id} value={id} className="bg-(--surface-elevated) text-(--text-primary)">
                {t(BUILT_IN_PRESET_LABELS[id])}
              </option>
            ))}
            {customPresets.length > 0 && (
              <optgroup
                label={t("novelcrafterPromptStudioPresetCustomGroup")}
                className="bg-(--surface-elevated) text-(--text-primary)"
              >
                {customPresets.map((preset) => (
                  <option
                    key={preset.id}
                    value={preset.id}
                    className="bg-(--surface-elevated) text-(--text-primary)"
                  >
                    {preset.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <button
            type="button"
            onClick={() => onApplyPreset(effectiveSelected)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-semibold text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <span>{t("novelcrafterPromptStudioPresetApply")}</span>
          </button>

          {isCustomSelected && (
            <button
              type="button"
              onClick={() => onDeletePreset(effectiveSelected)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-(--danger)/40 bg-(--danger)/10 hover:bg-(--danger)/20 text-xs font-semibold text-(--danger) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t("novelcrafterPromptStudioPresetDelete")}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            maxLength={FIELD_MAX_LENGTHS.promptPresetName}
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder={t("novelcrafterPromptStudioPresetNamePlaceholder")}
            aria-label={t("novelcrafterPromptStudioPresetNamePlaceholder")}
            className="h-9 w-52 sm:w-60 rounded-lg border border-(--control-border) bg-(--control-bg) px-3 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t("novelcrafterPromptStudioPresetSaveAs")}</span>
          </button>
          <button
            type="button"
            onClick={onResetAll}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t("novelcrafterPromptStudioResetAll")}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
