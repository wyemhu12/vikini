// /app/features/novelcrafter/components/prompt-studio/PromptStudioXmlPreview.tsx
"use client";

import React from "react";
import { Copy } from "lucide-react";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import type { PromptStudioPreviewResult } from "@/lib/features/novelcrafter/promptStudioPreview";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";

const previewLogger = logger.withContext("PromptStudioXmlPreview");

interface PromptStudioXmlPreviewProps {
  previewResult: PromptStudioPreviewResult;
}

export default function PromptStudioXmlPreview({ previewResult }: PromptStudioXmlPreviewProps) {
  const { t } = useLanguage();

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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs md:text-sm font-bold text-(--text-primary)">
          {t("novelcrafterPromptStudioPreviewLabel")}
        </h3>
        {previewResult.ok && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <Copy className="w-3.5 h-3.5 text-(--accent)" />
            <span>{t("novelcrafterPromptStudioCopyPreview")}</span>
          </button>
        )}
      </div>

      {previewResult.ok ? (
        <pre
          role="region"
          aria-label={t("novelcrafterPromptStudioPreviewLabel")}
          className="w-full max-h-96 overflow-auto rounded-xl border border-(--border) bg-(--surface)/90 p-4 text-xs font-mono leading-relaxed text-(--text-primary) whitespace-pre-wrap break-words custom-scrollbar"
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
