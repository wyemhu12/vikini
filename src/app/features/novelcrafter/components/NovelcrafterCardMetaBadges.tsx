// /app/features/novelcrafter/components/NovelcrafterCardMetaBadges.tsx
"use client";

import React from "react";
import { AlertTriangle, Cpu, Crown, UserCheck } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import { resolveModelDisplayInfo } from "@/lib/features/novelcrafter/modelDisplay";
import type { NovelcrafterFinishReason } from "@/lib/features/novelcrafter/types";

interface NovelcrafterCardMetaBadgesProps {
  model?: string | null;
  routedModel?: string | null;
  gemName?: string | null;
  personaName?: string | null;
  finishReason?: NovelcrafterFinishReason | null;
}

const PROVIDER_BADGE_STYLES: Record<string, string> = {
  google: "bg-(--accent)/12 text-(--accent) border-(--accent)/30",
  anthropic: "bg-(--warning)/12 text-(--warning) border-(--warning)/30",
  groq: "bg-(--success)/12 text-(--success) border-(--success)/30",
  openrouter: "bg-(--control-bg) text-(--text-primary) border-(--control-border)",
  unknown: "bg-(--control-bg) text-(--text-secondary) border-(--border)",
};

export default function NovelcrafterCardMetaBadges({
  model,
  routedModel,
  gemName,
  personaName,
  finishReason,
}: NovelcrafterCardMetaBadgesProps) {
  const { t } = useLanguage();
  const modelInfo = resolveModelDisplayInfo(model, routedModel);
  const displayName =
    modelInfo.id === "unknown" ? t("novelcrafterCardModelUnknown") : modelInfo.displayName;
  const badgeStyle = PROVIDER_BADGE_STYLES[modelInfo.providerId] || PROVIDER_BADGE_STYLES.unknown;
  const tooltipText = modelInfo.routedVia
    ? `${displayName} (${modelInfo.providerLabel}) · ${t("novelcrafterCardRoutedVia").replace("{model}", modelInfo.routedVia)}`
    : `${displayName} (${modelInfo.providerLabel})`;

  const finishWarning =
    finishReason === "length"
      ? t("novelcrafterFinishReasonLengthWarning")
      : finishReason === "safety"
        ? t("novelcrafterFinishReasonSafetyWarning")
        : finishReason === "aborted"
          ? t("novelcrafterFinishReasonAbortedWarning")
          : null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap text-xs text-(--text-secondary)">
      <span
        data-testid="card-model-badge"
        title={tooltipText}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-medium max-w-[160px]",
          badgeStyle
        )}
      >
        <Cpu className="w-3 h-3 shrink-0" />
        <span className="truncate">{displayName}</span>
      </span>

      {gemName && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-(--control-bg) border border-(--border)">
          <Crown className="w-3 h-3 text-(--accent) shrink-0" />
          <span className="truncate max-w-[110px]">{gemName}</span>
        </span>
      )}

      {personaName && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-(--control-bg) border border-(--border)">
          <UserCheck className="w-3 h-3 text-(--accent) shrink-0" />
          <span className="truncate max-w-[110px]">{personaName}</span>
        </span>
      )}

      {finishWarning && (
        <span
          data-testid="card-finish-reason-badge"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-(--warning)/15 border border-(--warning)/40 text-(--warning) font-medium"
        >
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>{finishWarning}</span>
        </span>
      )}
    </div>
  );
}
