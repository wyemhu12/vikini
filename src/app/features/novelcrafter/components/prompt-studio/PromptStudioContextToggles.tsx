// /app/features/novelcrafter/components/prompt-studio/PromptStudioContextToggles.tsx
"use client";

import React from "react";
import { GitBranch, Lock } from "lucide-react";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import type { NovelcrafterContextNode } from "@/lib/features/novelcrafter/contextNodes";
import { cn } from "@/lib/utils/cn";
import { CONTEXT_NODE_LABELS } from "./promptStudioLabels";

const STORY_BIBLE_NODES: readonly NovelcrafterContextNode[] = [
  "synopsis",
  "outline",
  "characters",
  "worldbuilding",
  "style",
  "genre",
  "pov_tense",
];

const CHAPTER_CONTEXT_NODES: readonly NovelcrafterContextNode[] = [
  "story_so_far",
  "scenes",
  "previous_chapter_continuity",
  "preceding_prose",
];

interface PromptStudioContextTogglesProps {
  activeNodes: readonly NovelcrafterContextNode[];
  requiredNodes: readonly NovelcrafterContextNode[];
  onToggleNode: (node: NovelcrafterContextNode) => void;
}

export default function PromptStudioContextToggles({
  activeNodes,
  requiredNodes,
  onToggleNode,
}: PromptStudioContextTogglesProps) {
  const { t } = useLanguage();

  const groups = [
    { labelKey: "novelcrafterPromptStudioStoryBibleNodes" as const, nodes: STORY_BIBLE_NODES },
    { labelKey: "novelcrafterPromptStudioChapterNodes" as const, nodes: CHAPTER_CONTEXT_NODES },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="flex items-center gap-1.5 text-xs md:text-sm font-bold text-(--text-primary)">
          <GitBranch className="w-4 h-4 text-(--accent)" />
          <span>{t("novelcrafterPromptStudioContextLabel")}</span>
        </h3>
        <p className="text-xs text-(--text-secondary)">{t("novelcrafterPromptStudioFlowHint")}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map((grp) => (
          <div
            key={grp.labelKey}
            className="rounded-xl border border-(--border) bg-(--surface-muted)/50 p-3 space-y-2.5"
          >
            <h4 className="px-2 py-1 rounded-md bg-(--accent)/15 border border-(--accent)/30 text-xs font-bold text-(--accent)">
              {t(grp.labelKey)}
            </h4>
            <div className="flex flex-wrap gap-2">
              {grp.nodes.map((node) => {
                const isActive = activeNodes.includes(node);
                const isRequired = requiredNodes.includes(node);
                return (
                  <button
                    key={node}
                    type="button"
                    disabled={isRequired}
                    aria-pressed={isActive}
                    onClick={() => onToggleNode(node)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                      isActive
                        ? "bg-(--accent)/15 border-(--accent) text-(--accent) font-semibold"
                        : "bg-(--control-bg) border-(--control-border) text-(--text-secondary) hover:text-(--text-primary)",
                      isRequired && "opacity-90 cursor-not-allowed"
                    )}
                  >
                    {isRequired && <Lock className="w-3 h-3 shrink-0" />}
                    <span>{t(CONTEXT_NODE_LABELS[node])}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
