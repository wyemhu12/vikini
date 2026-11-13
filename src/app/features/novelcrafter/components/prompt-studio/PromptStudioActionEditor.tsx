// /app/features/novelcrafter/components/prompt-studio/PromptStudioActionEditor.tsx
"use client";

import React, { useId, useMemo, useState } from "react";
import { Info, RotateCcw, Save } from "lucide-react";
import {
  MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS,
  type NovelcrafterContextNode,
} from "@/lib/features/novelcrafter/contextNodes";
import type { NovelcrafterPromptActionKey } from "@/lib/features/novelcrafter/promptActions";
import type { PromptStudioPreviewResult } from "@/lib/features/novelcrafter/promptStudioPreview";
import {
  collectPresentContextNodes,
  parseXmlPreviewNodes,
} from "@/lib/features/novelcrafter/xmlPreviewHighlighter";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../../chat/hooks/useLanguage";
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

  const [highlightedNode, setHighlightedNode] = useState<NovelcrafterContextNode | null>(null);
  const [scrollRequest, setScrollRequest] = useState<{
    node: NovelcrafterContextNode;
    seq: number;
  } | null>(null);
  const [prevActionKey, setPrevActionKey] = useState<NovelcrafterPromptActionKey>(selectedKey);

  if (prevActionKey !== selectedKey) {
    setPrevActionKey(selectedKey);
    if (highlightedNode !== null) setHighlightedNode(null);
  }

  const parsedXmlNodes = useMemo(
    () => (previewResult.ok ? parseXmlPreviewNodes(previewResult.xml) : []),
    [previewResult]
  );

  const presentContextNodes = useMemo(
    () => collectPresentContextNodes(parsedXmlNodes),
    [parsedXmlNodes]
  );

  const handleLocateNode = (node: NovelcrafterContextNode) => {
    setHighlightedNode(node);
    setScrollRequest((prev) => ({ node, seq: (prev?.seq ?? 0) + 1 }));
  };

  const hasLockedTail =
    selectedKey === "write:openings_3" ||
    selectedKey.startsWith("rewrite:") ||
    selectedKey.startsWith("feedback:");

  const isEdited = isCustomized || isDirty;

  return (
    <div className="min-w-0 shrink-0 md:shrink md:flex-1 md:min-h-0 flex flex-col md:overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] custom-scrollbar">
      {/* Left Pane: Action Header, Directive Textarea & 2-Column Context Toggle Cards */}
      <div className="min-w-0 shrink-0 lg:shrink lg:min-h-0 p-4 sm:p-5 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-(--line) lg:overflow-y-auto custom-scrollbar">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-(--text) leading-snug">
              {t(PROMPT_ACTION_LABELS[selectedKey])}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className={cn(isEdited ? "text-(--accent)" : "text-(--faint)")}>
                {isEdited
                  ? t("novelcrafterPromptStudioEditedStatus")
                  : t("novelcrafterPromptStudioDefaultStatus")}
              </span>
              {isDirty && (
                <span className="px-1.5 py-0.5 rounded bg-(--soft) text-(--text) ring-1 ring-(--accent)/45 font-medium">
                  {t("novelcrafterPromptStudioUnsaved")}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={!isEdited}
              onClick={onResetAction}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-(--line) bg-(--bg) hover:bg-(--raised) text-xs font-medium text-(--muted) hover:text-(--text) transition-colors disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t("novelcrafterPromptStudioRestoreShort")}</span>
            </button>

            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-(--accent) text-(--on-accent) hover:brightness-110 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t("novelcrafterPromptStudioSaveShort")}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={directiveInputId}
              className="text-xs sm:text-sm font-semibold text-(--text)"
            >
              {t("novelcrafterPromptStudioDirectiveLabel")}
            </label>
            <span className="font-mono text-xs text-(--faint)">
              {draftDirective.length}/{MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS}
            </span>
          </div>

          <textarea
            id={directiveInputId}
            rows={4}
            maxLength={MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS}
            value={draftDirective}
            onChange={(e) => onChangeDirective(e.target.value)}
            className="w-full rounded-xl border border-(--line) bg-(--bg) px-3 py-2.5 text-xs sm:text-sm leading-relaxed text-(--text) placeholder:text-(--faint) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
          />

          {hasLockedTail && (
            <p className="flex items-start gap-1.5 text-xs text-(--muted) bg-(--bg) border border-(--line) rounded-lg px-2.5 py-2">
              <Info className="w-3.5 h-3.5 text-(--accent) shrink-0 mt-0.5" />
              <span>{t("novelcrafterPromptStudioLockedTailNote")}</span>
            </p>
          )}
        </div>

        <PromptStudioContextToggles
          activeNodes={draftNodes}
          requiredNodes={requiredNodes}
          presentContextNodes={presentContextNodes}
          highlightedNode={highlightedNode}
          onToggleNode={onToggleNode}
          onHoverNode={setHighlightedNode}
          onLocateNode={handleLocateNode}
        />
      </div>

      {/* Right Pane: Full-Height Live XML Inspector */}
      <div className="min-w-0 shrink-0 lg:shrink lg:min-h-0 p-4 sm:p-5 flex flex-col lg:overflow-hidden bg-(--surface)">
        <PromptStudioXmlPreview
          previewResult={previewResult}
          parsedNodes={parsedXmlNodes}
          highlightedNode={highlightedNode}
          scrollRequest={scrollRequest}
          onHoverNode={setHighlightedNode}
        />
      </div>
    </div>
  );
}
