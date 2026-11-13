// /app/features/novelcrafter/components/prompt-studio/PromptStudioXmlPreview.tsx
"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Copy } from "lucide-react";
import {
  estimatePromptTokens,
  formatApproxTokens,
} from "@/lib/features/novelcrafter/aiInheritanceTable";
import type { NovelcrafterContextNode } from "@/lib/features/novelcrafter/contextNodes";
import type { PromptStudioPreviewResult } from "@/lib/features/novelcrafter/promptStudioPreview";
import {
  normalizeBlockDisplayChildren,
  type XmlPreviewNode,
} from "@/lib/features/novelcrafter/xmlPreviewHighlighter";
import { toast } from "@/lib/store/toastStore";
import { cn } from "@/lib/utils/cn";
import { logger } from "@/lib/utils/logger";
import type { TranslationKey } from "@/lib/utils/translations";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import { XML_GROUP_STYLES } from "./promptStudioLabels";

const previewLogger = logger.withContext("PromptStudioXmlPreview");

const SAMPLE_SECTION_LABELS: Record<string, TranslationKey> = {
  braindump: "novelcrafterBraindumpLabel",
  genre: "novelcrafterGenreLabel",
  style: "novelcrafterStyleLabel",
  synopsis: "novelcrafterSynopsisLabel",
  characters: "novelcrafterCharactersLabel",
  worldbuilding: "novelcrafterWorldbuildingLabel",
  outline: "novelcrafterOutlineLabel",
  chapter: "novelcrafterChaptersTab",
};

interface PromptStudioXmlPreviewProps {
  previewResult: PromptStudioPreviewResult;
  parsedNodes: readonly XmlPreviewNode[];
  highlightedNode: NovelcrafterContextNode | null;
  scrollRequest: { node: NovelcrafterContextNode; seq: number } | null;
  onHoverNode: (node: NovelcrafterContextNode | null) => void;
}

export default function PromptStudioXmlPreview({
  previewResult,
  parsedNodes,
  highlightedNode,
  scrollRequest,
  onHoverNode,
}: PromptStudioXmlPreviewProps) {
  const { t, language } = useLanguage();
  const elementRefs = useRef<Partial<Record<NovelcrafterContextNode, HTMLDivElement | null>>>({});

  useEffect(() => {
    if (!scrollRequest) return;
    const el = elementRefs.current[scrollRequest.node];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [scrollRequest]);

  const displayRootNodes = useMemo(() => normalizeBlockDisplayChildren(parsedNodes), [parsedNodes]);

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

  const sampleNotice = !previewResult.ok
    ? null
    : previewResult.usedSample
      ? t("novelcrafterPreviewAllSampleNotice")
      : previewResult.sampleSections && previewResult.sampleSections.length > 0
        ? previewResult.sampleSections
            .map((id) => (SAMPLE_SECTION_LABELS[id] ? t(SAMPLE_SECTION_LABELS[id]) : id))
            .join(", ")
        : null;

  const renderXmlNode = (node: XmlPreviewNode): React.ReactNode => {
    if (node.kind === "text-block") {
      return (
        <div key={node.id} className="whitespace-pre-wrap break-words text-(--text)">
          {node.segments.map((seg, idx) =>
            seg.kind === "text" ? (
              <React.Fragment key={idx}>{seg.value}</React.Fragment>
            ) : (
              <span key={idx} className={cn("font-semibold", XML_GROUP_STYLES[seg.group].text)}>
                {seg.raw}
              </span>
            )
          )}
        </div>
      );
    }

    const style = XML_GROUP_STYLES[node.group];
    const contextNode = node.contextNode;
    const isHighlighted = contextNode !== null && highlightedNode === contextNode;

    if (node.isInline) {
      return (
        <div
          key={node.id}
          ref={
            contextNode
              ? (el) => {
                  elementRefs.current[contextNode] = el;
                }
              : undefined
          }
          data-context-node={contextNode ?? undefined}
          data-highlighted={isHighlighted ? "true" : undefined}
          onMouseEnter={contextNode ? () => onHoverNode(contextNode) : undefined}
          onMouseLeave={contextNode ? () => onHoverNode(null) : undefined}
          className={cn(
            "rounded-md px-1 -mx-1 py-0.5 whitespace-pre-wrap break-words transition-colors",
            isHighlighted && style.activeHighlight
          )}
        >
          <span className={cn("font-semibold", style.text)}>{node.openTagRaw}</span>
          {node.inlineText ? <span className="text-(--text)">{node.inlineText}</span> : null}
          {node.closeTagRaw ? (
            <span className={cn("font-semibold", style.text)}>{node.closeTagRaw}</span>
          ) : null}
        </div>
      );
    }

    const normalizedChildren = normalizeBlockDisplayChildren(node.children);
    return (
      <div
        key={node.id}
        ref={
          contextNode
            ? (el) => {
                elementRefs.current[contextNode] = el;
              }
            : undefined
        }
        data-context-node={contextNode ?? undefined}
        data-highlighted={isHighlighted ? "true" : undefined}
        onMouseEnter={contextNode ? () => onHoverNode(contextNode) : undefined}
        onMouseLeave={contextNode ? () => onHoverNode(null) : undefined}
        className={cn(
          "group/xml rounded-md px-1 -mx-1 py-0.5 transition-colors",
          isHighlighted && style.activeHighlight
        )}
      >
        <div className={cn("font-semibold break-words", style.text)}>{node.openTagRaw}</div>
        {normalizedChildren.length > 0 && (
          <div
            className={cn(
              "pl-3 ml-1.5 my-0.5 border-l border-(--line) flex flex-col gap-1 transition-colors",
              isHighlighted ? style.guideHover : "group-hover/xml:border-(--muted)/50"
            )}
          >
            {normalizedChildren.map((child) => renderXmlNode(child))}
          </div>
        )}
        {node.closeTagRaw && (
          <div className={cn("font-semibold break-words", style.text)}>{node.closeTagRaw}</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2 lg:h-full lg:flex-1 min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
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

      {sampleNotice && (
        <p className="text-xs text-(--muted) shrink-0">
          {!previewResult.ok || previewResult.usedSample ? (
            sampleNotice
          ) : (
            <>
              <span>{t("novelcrafterPreviewSampleNotice")}</span> <span>{sampleNotice}</span>
            </>
          )}
        </p>
      )}

      {previewResult.ok ? (
        <div
          role="region"
          aria-label={t("novelcrafterPromptStudioPreviewShort")}
          className="w-full max-h-96 lg:max-h-none lg:flex-1 min-h-0 overflow-auto rounded-xl border border-(--line) bg-(--bg) p-3.5 text-xs font-mono leading-relaxed space-y-2 custom-scrollbar"
        >
          {displayRootNodes.map((node) => renderXmlNode(node))}
        </div>
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
