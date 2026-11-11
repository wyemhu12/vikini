// /app/features/novelcrafter/components/prompt-studio/PromptStudioXmlPreview.tsx
"use client";

import React from "react";
import { Copy } from "lucide-react";
import {
  estimatePromptTokens,
  formatApproxTokens,
} from "@/lib/features/novelcrafter/aiInheritanceTable";
import type { PromptStudioPreviewResult } from "@/lib/features/novelcrafter/promptStudioPreview";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import { useLanguage } from "../../../chat/hooks/useLanguage";

const previewLogger = logger.withContext("PromptStudioXmlPreview");

interface PromptStudioXmlPreviewProps {
  previewResult: PromptStudioPreviewResult;
}

export default function PromptStudioXmlPreview({ previewResult }: PromptStudioXmlPreviewProps) {
  const { t, language } = useLanguage();

  const handleCopy = async () => {
    if (!previewResult.ok) return;
    try {
      await navigator.clipboard.writeText(previewResult.xml);
      toast.success(t("novelcrafterPromptStudioCopied"));
    } catch (err: unknown) {
      previewLogger.error("Failed to copy XML preview to clipboard:", err);
      toast.error(t("novelcrafterPromptStudioPreviewError"));
    }
  };

  const approxTokensLabel = previewResult.ok
    ? t("novelcrafterPromptStudioApproxTokens").replace(
        "{tokens}",
        formatApproxTokens(estimatePromptTokens(previewResult.xml), language)
      )
    : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-semibold text-(--text)">
          {t("novelcrafterPromptStudioPreviewShort")}
        </span>
        {previewResult.ok && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-xs text-(--faint)">{approxTokensLabel}</span>
            <button
              type="button"
              onClick={() => void handleCopy()}
              aria-label={t("novelcrafterPromptStudioCopyPreview")}
              title={t("novelcrafterPromptStudioCopyPreview")}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-(--line) bg-(--bg) hover:bg-(--raised) text-(--muted) hover:text-(--text) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {previewResult.ok ? (
        <pre
          role="region"
          aria-label={t("novelcrafterPromptStudioPreviewShort")}
          className="w-full max-h-60 overflow-auto rounded-xl border border-(--line) bg-(--bg) p-3 text-xs font-mono leading-relaxed text-(--muted) whitespace-pre-wrap break-words custom-scrollbar"
        >
          {previewResult.xml}
        </pre>
      ) : (
        <div
          role="alert"
          className="rounded-xl border border-(--danger)/40 bg-(--danger)/10 p-3 text-xs text-(--danger)"
        >
          {previewResult.message || t("novelcrafterPromptStudioPreviewError")}
        </div>
      )}
    </div>
  );
}
