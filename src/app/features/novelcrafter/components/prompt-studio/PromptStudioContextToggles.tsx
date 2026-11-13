// /app/features/novelcrafter/components/prompt-studio/PromptStudioContextToggles.tsx
"use client";

import React from "react";
import { Check, Crosshair, Lock } from "lucide-react";
import type { NovelcrafterContextNode } from "@/lib/features/novelcrafter/contextNodes";
import {
  CONTEXT_NODE_XML_TAGS,
  getContextNodeSemanticGroup,
} from "@/lib/features/novelcrafter/xmlPreviewHighlighter";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import { CONTEXT_NODE_SHORT_LABELS, XML_GROUP_STYLES } from "./promptStudioLabels";

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
  presentContextNodes: ReadonlySet<NovelcrafterContextNode>;
  highlightedNode: NovelcrafterContextNode | null;
  onToggleNode: (node: NovelcrafterContextNode) => void;
  onHoverNode: (node: NovelcrafterContextNode | null) => void;
  onLocateNode: (node: NovelcrafterContextNode) => void;
}

export default function PromptStudioContextToggles({
  activeNodes,
  requiredNodes,
  presentContextNodes,
  highlightedNode,
  onToggleNode,
  onHoverNode,
  onLocateNode,
}: PromptStudioContextTogglesProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs sm:text-sm font-semibold text-(--text)">
        {t("novelcrafterPromptStudioContextShort")}
      </span>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ALL_CONTEXT_NODES.map((node) => {
          const isActive = activeNodes.includes(node);
          const isRequired = requiredNodes.includes(node);
          const shortLabel = t(CONTEXT_NODE_SHORT_LABELS[node]);
          const xmlTag = CONTEXT_NODE_XML_TAGS[node];
          const group = getContextNodeSemanticGroup(node);
          const groupStyle = XML_GROUP_STYLES[group];
          const isHighlighted = highlightedNode === node;
          const canLocate = isActive && presentContextNodes.has(node);

          return (
            <div
              key={node}
              data-context-node={node}
              data-highlighted={isHighlighted ? "true" : undefined}
              onMouseEnter={() => onHoverNode(node)}
              onMouseLeave={() => onHoverNode(null)}
              className={cn(
                "rounded-xl border flex items-center gap-1 transition-colors min-w-0",
                isActive ? "bg-(--bg) border-(--line)" : "bg-(--surface) border-(--line)/80",
                isHighlighted && groupStyle.activeHighlight
              )}
            >
              <label
                className={cn(
                  "flex-1 min-w-0 flex items-center gap-2.5 py-2 pl-2.5 pr-1.5 text-xs select-none",
                  isRequired ? "cursor-not-allowed" : "cursor-pointer"
                )}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  disabled={isRequired}
                  aria-label={`${shortLabel} (<${xmlTag}>)`}
                  onChange={() => onToggleNode(node)}
                  onFocus={() => onHoverNode(node)}
                  onBlur={() => onHoverNode(null)}
                  className="sr-only peer"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-(--ring)",
                    isActive
                      ? "border-(--accent) bg-(--accent) text-(--on-accent)"
                      : "border-(--line) bg-transparent"
                  )}
                >
                  {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                </span>

                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="font-medium text-(--text) truncate">{shortLabel}</span>
                    {isRequired && (
                      <Lock
                        aria-label={t("novelcrafterPromptStudioRequiredNode")}
                        className="w-3 h-3 text-(--faint) shrink-0"
                      />
                    )}
                  </span>
                  <span
                    className={cn(
                      "self-start max-w-full truncate font-mono text-xs px-1.5 py-0.5 rounded border leading-tight",
                      groupStyle.badge
                    )}
                  >
                    {`<${xmlTag}>`}
                  </span>
                </span>
              </label>

              {canLocate && (
                <button
                  type="button"
                  aria-label={`${t("novelcrafterPromptStudioLocateXmlTag")}: <${xmlTag}>`}
                  title={`${t("novelcrafterPromptStudioLocateXmlTag")}: <${xmlTag}>`}
                  onFocus={() => onHoverNode(node)}
                  onBlur={() => onHoverNode(null)}
                  onClick={() => onLocateNode(node)}
                  className="mr-1.5 inline-flex items-center justify-center w-7 h-7 rounded-md text-(--muted) hover:text-(--text) hover:bg-(--raised) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none shrink-0"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
