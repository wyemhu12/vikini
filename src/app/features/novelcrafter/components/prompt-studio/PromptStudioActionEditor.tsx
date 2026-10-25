// /app/features/novelcrafter/components/prompt-studio/PromptStudioActionEditor.tsx
"use client";

import React, { useId } from "react";
import { Info, RotateCcw, Save } from "lucide-react";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import {
  MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS,
  type NovelcrafterContextNode,
} from "@/lib/features/novelcrafter/contextNodes";
import type { NovelcrafterPromptActionKey } from "@/lib/features/novelcrafter/promptActions";
import type { PromptStudioPreviewResult } from "@/lib/features/novelcrafter/promptStudioPreview";
import { PROMPT_ACTION_LABELS } from "./promptStudioLabels";
import PromptStudioContextToggles from "./PromptStudioContextToggles";
import PromptStudioXmlPreview from "./PromptStudioXmlPreview";

interface PromptStudioActionEditorProps {
  selectedKey: NovelcrafterPromptActionKey;
  draftDirective: string;
  onChangeDirective: (val: string) => void;
  draftNodes: readonly NovelcrafterContextNode[];
  requiredNodes: readonly NovelcrafterContextNode[];
  onToggleNode: (node: NovelcrafterContextNode) => void;
  isDirty: boolean;
  isCustomized: boolean;
  previewResult: PromptStudioPreviewResult;
  onSave: () => void;
  onResetAction: () => void;
}

export default function PromptStudioActionEditor({
  selectedKey,
  draftDirective,
  onChangeDirective,
  draftNodes,
  requiredNodes,
  onToggleNode,
  isDirty,
  isCustomized,
  previewResult,
  onSave,
  onResetAction,
}: PromptStudioActionEditorProps) {
  const { t } = useLanguage();
  const directiveInputId = useId();
  const hasLockedTail =
    selectedKey === "write:openings_3" ||
    selectedKey.startsWith("rewrite:") ||
    selectedKey.startsWith("feedback:");

  return (
    <div className="rounded-2xl border border-(--border) bg-(--surface-elevated)/60 p-4 md:p-6 space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-(--border) pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base md:text-lg font-bold text-(--text-primary)">
              {t(PROMPT_ACTION_LABELS[selectedKey])}
            </h2>
            <code className="px-2 py-0.5 rounded-md bg-(--surface-muted) border border-(--border) text-xs font-mono text-(--text-secondary)">
              {selectedKey}
            </code>
            {isDirty && (
              <span className="px-2 py-0.5 rounded-full bg-(--warning)/15 border border-(--warning)/40 text-xs font-semibold text-(--warning)">
                {t("novelcrafterPromptStudioUnsaved")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={!isCustomized && !isDirty}
            onClick={onResetAction}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-semibold text-(--text-primary) transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t("novelcrafterPromptStudioResetAction")}</span>
          </button>

          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t("novelcrafterPromptStudioSave")}</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={directiveInputId}
            className="text-xs md:text-sm font-bold text-(--text-primary)"
          >
            {t("novelcrafterPromptStudioDirectiveLabel")}
          </label>
          <span className="text-xs text-(--text-secondary)">
            {draftDirective.length}/{MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS}
          </span>
        </div>

        <p className="text-xs text-(--text-secondary)">
          {t("novelcrafterPromptStudioDirectiveHint")}
        </p>

        <textarea
          id={directiveInputId}
          rows={5}
          maxLength={MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS}
          value={draftDirective}
          onChange={(e) => onChangeDirective(e.target.value)}
          className="w-full rounded-xl border border-(--control-border) bg-(--control-bg) px-4 py-3 text-sm leading-relaxed text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
        />

        {hasLockedTail && (
          <p className="flex items-start gap-1.5 text-xs text-(--text-secondary) bg-(--surface-muted)/60 border border-(--border) rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 text-(--accent) shrink-0 mt-0.5" />
            <span>{t("novelcrafterPromptStudioLockedTailNote")}</span>
          </p>
        )}
      </div>

      <PromptStudioContextToggles
        activeNodes={draftNodes}
        requiredNodes={requiredNodes}
        onToggleNode={onToggleNode}
      />

      <PromptStudioXmlPreview previewResult={previewResult} />
    </div>
  );
}
