// /app/features/research/components/ResearchAgentSelector.tsx
"use client";

import React from "react";
import { Zap, Brain, Sparkles } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import type { ResearchAgent } from "@/lib/features/research/types";

interface ResearchAgentSelectorProps {
  selectedAgent: ResearchAgent;
  onSelect: (agent: ResearchAgent) => void;
  disabled?: boolean;
}

interface AgentOption {
  id: ResearchAgent;
  icon: typeof Zap;
  labelKey: string;
  /** i18n key for the short description shown below the label (UX-05) */
  descriptionKey: string;
}

// UX-01: All three agents are now exposed (previously "max" was missing).
const AGENTS: AgentOption[] = [
  {
    id: "deep-research-fast-04-2026",
    icon: Zap,
    labelKey: "deepResearchAgentFast",
    descriptionKey: "deepResearchAgentFastDesc",
  },
  {
    id: "deep-research-preview-04-2026",
    icon: Brain,
    labelKey: "deepResearchAgentDeep",
    descriptionKey: "deepResearchAgentDeepDesc",
  },
  {
    id: "deep-research-max-preview-04-2026",
    icon: Sparkles,
    labelKey: "deepResearchAgentMax",
    descriptionKey: "deepResearchAgentMaxDesc",
  },
];

export default function ResearchAgentSelector({
  selectedAgent,
  onSelect,
  disabled = false,
}: ResearchAgentSelectorProps) {
  const { t } = useLanguage();

  return (
    <div className="w-full">
      <p className="text-xs font-medium text-(--text-secondary) mb-2">
        {t("deepResearchSelectAgent")}
      </p>
      <div className="flex gap-2">
        {AGENTS.map((agent) => {
          const isSelected = selectedAgent === agent.id;
          const Icon = agent.icon;

          return (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              disabled={disabled}
              aria-pressed={isSelected}
              title={t(agent.descriptionKey)}
              className={`flex-1 flex flex-col items-start gap-1 px-3 py-2.5 rounded-(--radius) border text-left transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) ${
                isSelected
                  ? "border-(--accent) bg-(--accent)/10 text-(--text-primary)"
                  : "border-(--control-border) bg-(--control-bg) text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary)"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isSelected ? "text-(--accent)" : "text-(--text-secondary)"
                  }`}
                />
                <span className="text-xs font-medium">{t(agent.labelKey)}</span>
              </span>
              {/* UX-05: Description line helps users choose the right agent */}
              <span className="text-[10px] leading-tight text-(--text-secondary) pl-0.5">
                {t(agent.descriptionKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
