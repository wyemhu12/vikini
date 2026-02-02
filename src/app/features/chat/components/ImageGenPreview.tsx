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
  if (model.includes("imagen-4")) return "Imagen 4";
  if (model.includes("flux-schnell")) return "Flux";
  if (model.includes("dall-e")) return "DALL·E 3";
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
      <div className="mt-4 rounded-xl overflow-hidden border border-token shadow-sm max-w-sm bg-surface-elevated">
        {/* Image with hover overlay */}
        <div
          className="relative group cursor-pointer overflow-hidden"
          onClick={() => setShowLightbox(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowLightbox(true);
            }
          }}
          aria-label={t("imageFullscreen") || "View fullscreen"}
        >
          <img
            src={sanitizeImageUrl(imageUrl)}
            alt={prompt || "Generated Image"}
            className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <Expand className="w-5 h-5 text-white" />
              <span className="text-white text-sm font-medium">
                {t("imageFullscreen") || "View"}
              </span>
            </div>
          </div>
        </div>

        {/* Metadata Badges */}
        {hasOptions && (
          <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-token bg-surface-muted/50">
            {options.model && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {formatModelName(options.model)}
              </span>
            )}
            {options.aspectRatio && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/20 text-secondary border border-token">
                {options.aspectRatio}
              </span>
            )}
            {options.style && options.style !== "none" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 capitalize">
                {options.style.replace("-", " ")}
              </span>
            )}
            {options.enhancer && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Magic
              </span>
            )}
          </div>
        )}

        {/* Prompt Footer */}
        <div className="bg-surface-muted px-3 py-2 text-xs text-secondary border-b border-token">
          <p className="truncate max-w-full" title={prompt}>
            {prompt}
          </p>
        </div>

        {/* Action Footer */}
        <div className="bg-surface-elevated px-2 py-1.5 flex justify-between items-center">
          {/* Left: Quick Actions */}
          <div className="flex gap-1">
            <button
              onClick={handleCopyUrl}
              className="p-1.5 rounded-md hover:bg-control-hover text-secondary hover:text-primary transition-colors"
              title={t("imageCopyUrl") || "Copy URL"}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-md hover:bg-control-hover text-secondary hover:text-primary transition-colors"
              title={t("studioDownload") || "Download"}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Regenerate/Edit */}
          <div className="flex gap-1">
            {onRegenerate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate(message);
                }}
                className="p-1.5 rounded-md hover:bg-control-hover text-secondary hover:text-primary transition-colors"
                title={t("regenerate") || "Regenerate Image"}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(message);
                }}
                className="p-1.5 rounded-md hover:bg-control-hover text-secondary hover:text-primary transition-colors"
                title={t("edit") || "Edit Prompt"}
              >
                <Pencil className="w-3.5 h-3.5" />
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
