// /app/features/novelcrafter/components/ChapterAiBrainstormMenu.tsx
"use client";

import React, { useState } from "react";
import { Info } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import {
  NOVELCRAFTER_BRAINSTORM_CATEGORIES,
  type NovelcrafterBrainstormCategory,
} from "@/lib/features/novelcrafter/types";
import { BRAINSTORM_LABELS } from "./ChapterAiToolbar";
import PromptSourceTooltip from "./PromptSourceTooltip";

interface ChapterAiBrainstormMenuProps {
  isStreaming: boolean;
  onRunBrainstorm: (
    category: NovelcrafterBrainstormCategory,
    label: string,
    topic?: string
  ) => void;
}

const INPUT_CLS =
  "h-8 rounded-lg border border-(--control-border) bg-(--control-bg) px-3 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none";

export default function ChapterAiBrainstormMenu({
  isStreaming,
  onRunBrainstorm,
}: ChapterAiBrainstormMenuProps) {
  const { t } = useLanguage();
  const [brainstormTopic, setBrainstormTopic] = useState("");

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
        <Info className="w-3.5 h-3.5 text-(--accent) shrink-0" />
        <span>{t("novelcrafterBrainstormTooltip")}</span>
      </p>
      <input
        type="text"
        value={brainstormTopic}
        onChange={(e) => setBrainstormTopic(e.target.value)}
        placeholder={t("novelcrafterBrainstormTopicPlaceholder")}
        aria-label={t("novelcrafterBrainstormTopicPlaceholder")}
        className={`w-full ${INPUT_CLS}`}
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        {NOVELCRAFTER_BRAINSTORM_CATEGORIES.map((catKey) => (
          <PromptSourceTooltip
            key={catKey}
            actionKey={`brainstorm:${catKey}`}
            disabled={isStreaming}
            side="bottom"
          >
            <button
              type="button"
              disabled={isStreaming}
              onClick={() => onRunBrainstorm(catKey, t(BRAINSTORM_LABELS[catKey]), brainstormTopic)}
              className="px-2.5 py-1.5 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              {t(BRAINSTORM_LABELS[catKey])}
            </button>
          </PromptSourceTooltip>
        ))}
      </div>
    </div>
  );
}
