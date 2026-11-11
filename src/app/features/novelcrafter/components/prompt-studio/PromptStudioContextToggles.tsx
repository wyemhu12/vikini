// /app/features/novelcrafter/components/prompt-studio/PromptStudioContextToggles.tsx
"use client";

import React from "react";
import { Check, Lock } from "lucide-react";
import type { NovelcrafterContextNode } from "@/lib/features/novelcrafter/contextNodes";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import { CONTEXT_NODE_LABELS } from "./promptStudioLabels";

const ALL_CONTEXT_NODES: readonly NovelcrafterContextNode[] = [
  "synopsis",
  "outline",
  "characters",
  "worldbuilding",
  "style",
  "genre",
  "pov_tense",
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

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs sm:text-sm font-semibold text-(--text)">
        {t("novelcrafterPromptStudioContextShort")}
      </span>
      <div className="flex flex-col gap-1.5">
        {ALL_CONTEXT_NODES.map((node) => {
          const isActive = activeNodes.includes(node);
          const isRequired = requiredNodes.includes(node);
          const nodeLabel = t(CONTEXT_NODE_LABELS[node]);
          return (
            <label
              key={node}
              className={cn(
                "flex items-center gap-2.5 py-0.5 text-xs sm:text-sm text-(--text) select-none",
                isRequired ? "cursor-not-allowed opacity-85" : "cursor-pointer"
              )}
            >
              <input
                type="checkbox"
                checked={isActive}
                disabled={isRequired}
                aria-label={nodeLabel}
                onChange={() => onToggleNode(node)}
                className="sr-only peer"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-(--ring)",
                  isActive
                    ? "border-(--accent) bg-(--accent) text-(--on-accent)"
                    : "border-(--line) bg-transparent"
                )}
              >
                {isActive && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
              <span className="flex-1 min-w-0 truncate">{nodeLabel}</span>
              {isRequired && (
                <span className="inline-flex items-center gap-1 text-xs text-(--faint) shrink-0">
                  <Lock className="w-3 h-3" />
                  <span>{t("novelcrafterPromptStudioRequiredNode")}</span>
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
