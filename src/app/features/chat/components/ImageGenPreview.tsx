// /app/features/chat/components/ImageGenPreview.tsx
"use client";

import React, { useState, useCallback } from "react";
import { RefreshCw, Pencil, Expand, Copy, Download, Sparkles } from "lucide-react";
import { sanitizeImageUrl, sanitizeUrl } from "@/lib/utils/xssProtection";
import { useLanguage } from "../hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import ImageLightbox from "./ImageLightbox";

// ============================================
// Type Definitions
// ============================================

interface OriginalOptions {
  aspectRatio?: string;
  model?: string;
  style?: string;
  enhancer?: boolean;
}

interface ChatMessage {
  role: string;
  content: string;
  id?: string;
  meta?: {
    type?: string;
    imageUrl?: string;
    prompt?: string;
    originalOptions?: OriginalOptions;
    attachment?: {
      url: string;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ImageGenPreviewProps {
  message: ChatMessage;
  onRegenerate?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage) => void;
}

// ============================================
// Helper: Format model name for display
// ============================================

function formatModelName(model?: string): string {
  if (!model) return "";
  // Shorten common model names
  if (model.includes("gemini-3.1-flash-image")) return "Gemini Image Flash";
  if (model.includes("gemini-3-pro-image")) return "Gemini Image Pro";
  if (model.includes("gpt-image")) return "GPT Image 2";
  if (model.includes("imagen")) return "Gemini Image";
  if (model.includes("dall-e")) return "DALL·E 3";
  if (model.includes("flux-schnell")) return "Flux";
  return model;
}

// ============================================
// Component
// ============================================

function ImageGenPreview({ message, onRegenerate, onEdit }: ImageGenPreviewProps) {
  const { t } = useLanguage();
  const [showLightbox, setShowLightbox] = useState(false);

  const imageUrl = message.meta?.attachment?.url;
  const prompt = message.meta?.prompt;
  const options = message.meta?.originalOptions;

  const handleCopyUrl = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!imageUrl) return;
      try {
        await navigator.clipboard.writeText(imageUrl);
        toast.success(t("imageCopySuccess") || "URL copied!");
      } catch {
        toast.error(t("error") || "Failed to copy");
      }
    },
    [imageUrl, t]
  );

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!imageUrl) return;
      const link = document.createElement("a");
      link.href = sanitizeUrl(imageUrl);
      link.download = `generated-${Date.now()}.png`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [imageUrl]
  );

  if (!imageUrl) return null;

  const hasOptions = options && (options.model || options.aspectRatio || options.enhancer);

  return (
    <>
      <div className="mt-4 rounded-xl overflow-hidden border border-(--line) shadow-sm max-w-sm bg-(--surface)">
        {/* Image with accessible native button trigger & mobile-visible expand cue */}
        <button
          type="button"
          className="relative block w-full text-left group cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--ring)"
          onClick={() => setShowLightbox(true)}
          aria-label={t("imageFullscreen") || "View fullscreen"}
        >
          <img
            src={sanitizeImageUrl(imageUrl)}
            alt={prompt || t("imagePreviewTitle")}
            className="w-full h-auto object-cover transition-transform duration-300 ease-out group-hover:scale-105"
            loading="lazy"
          />

          {/* Mobile corner badge + Desktop hover/focus overlay */}
          <span
            aria-hidden="true"
            className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1.5 rounded-full border border-(--on-overlay)/20 bg-(--overlay) px-2.5 py-1 text-xs font-medium text-(--on-overlay) backdrop-blur-sm md:hidden"
          >
            <Expand className="w-3.5 h-3.5" />
            <span>{t("imageFullscreen")}</span>
          </span>
          <div className="hidden md:flex absolute inset-0 bg-(--overlay) opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 ease-out items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-(--on-overlay)/10 backdrop-blur-sm rounded-full border border-(--on-overlay)/20">
              <Expand className="w-5 h-5 text-(--on-overlay)" />
              <span className="text-(--on-overlay) text-sm font-medium">
                {t("imageFullscreen") || "View"}
              </span>
            </div>
          </div>
        </button>

        {/* Metadata Badges */}
        {hasOptions && (
          <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-(--line) bg-(--raised)/50">
            {options.model && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-(--accent)/20 text-(--accent) border border-(--accent)/30">
                {formatModelName(options.model)}
              </span>
            )}
            {options.aspectRatio && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-(--raised) text-(--muted) border border-(--line)">
                {options.aspectRatio}
              </span>
            )}
            {options.style && options.style !== "none" && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-(--success)/20 text-(--success) border border-(--success)/30 capitalize">
                {options.style.replace("-", " ")}
              </span>
            )}
            {options.enhancer && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-(--soft) text-(--accent) border border-(--accent)/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Magic
              </span>
            )}
          </div>
        )}

        {/* Prompt Footer */}
        <div className="bg-(--raised) px-3 py-2 text-xs text-(--muted) border-b border-(--line)">
          <p className="truncate max-w-full" title={prompt}>
            {prompt}
          </p>
        </div>

        {/* Action Footer */}
        <div className="bg-(--surface) px-2 py-1.5 flex justify-between items-center">
          {/* Left: Quick Actions */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="inline-flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded-md hover:bg-(--raised-hover) text-(--muted) hover:text-(--text) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              title={t("imageCopyUrl") || "Copy URL"}
              aria-label={t("imageCopyUrl") || "Copy URL"}
            >
              <Copy aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded-md hover:bg-(--raised-hover) text-(--muted) hover:text-(--text) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              title={t("studioDownload") || "Download"}
              aria-label={t("studioDownload") || "Download"}
            >
              <Download aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Regenerate/Edit */}
          <div className="flex gap-1">
            {onRegenerate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate(message);
                }}
                className="inline-flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded-md hover:bg-(--raised-hover) text-(--muted) hover:text-(--text) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                title={t("regenerate") || "Regenerate Image"}
                aria-label={t("regenerate") || "Regenerate Image"}
              >
                <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(message);
                }}
                className="inline-flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded-md hover:bg-(--raised-hover) text-(--muted) hover:text-(--text) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                title={t("edit") || "Edit Prompt"}
                aria-label={t("edit") || "Edit Prompt"}
              >
                <Pencil aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      <ImageLightbox
        isOpen={showLightbox}
        onClose={() => setShowLightbox(false)}
        imageUrl={imageUrl}
        imageAlt={prompt || "Generated Image"}
        prompt={prompt}
      />
    </>
  );
}

export default React.memo(ImageGenPreview);
