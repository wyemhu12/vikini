// /app/features/novelcrafter/components/prompt-studio/PromptStudioContextToggles.tsx
"use client";

import React from "react";
import { Lock } from "lucide-react";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import {
  NOVELCRAFTER_CONTEXT_NODES,
  type NovelcrafterContextNode,
} from "@/lib/features/novelcrafter/contextNodes";
import { cn } from "@/lib/utils/cn";
import { CONTEXT_NODE_LABELS } from "./promptStudioLabels";

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
    <div className="space-y-2">
      <h3 className="text-xs md:text-sm font-bold text-(--text-primary)">
        {t("novelcrafterPromptStudioContextLabel")}
      </h3>
      <div className="flex flex-wrap gap-2">
        {NOVELCRAFTER_CONTEXT_NODES.map((node) => {
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
              {isRequired && (
                <span className="text-[11px] opacity-80">
                  ({t("novelcrafterPromptStudioRequiredNode")})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
