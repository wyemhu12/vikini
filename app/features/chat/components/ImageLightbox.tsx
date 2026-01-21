// /app/features/chat/components/ImageLightbox.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut, Download, Copy, RotateCcw } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { sanitizeImageUrl, sanitizeUrl } from "@/lib/utils/xssProtection";

// ============================================
// Type Definitions
// ============================================

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageAlt?: string;
  prompt?: string;
}

// ============================================
// Constants
// ============================================

const ZOOM_STEP = 0.5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

// ============================================
// Component
// ============================================

function ImageLightbox({ isOpen, onClose, imageUrl, imageAlt, prompt }: ImageLightboxProps) {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(1);

  // Reset zoom when modal opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast.success(t("imageCopySuccess") || "URL copied!");
    } catch {
      toast.error(t("error") || "Failed to copy");
    }
  }, [imageUrl, t]);

  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = sanitizeUrl(imageUrl);
    link.download = `generated-${Date.now()}.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [imageUrl]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("imageFullscreen") || "Fullscreen image view"}
    >
      {/* Toolbar */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-xl z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Zoom controls */}
        <button
          onClick={handleZoomOut}
          disabled={zoom <= MIN_ZOOM}
          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={t("imageZoomOut") || "Zoom out"}
        >
          <ZoomOut className="w-5 h-5" />
        </button>

        <span className="text-white/80 text-sm font-mono min-w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={handleZoomIn}
          disabled={zoom >= MAX_ZOOM}
          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={t("imageZoomIn") || "Zoom in"}
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-white/20 mx-1" />

        <button
          onClick={handleResetZoom}
          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          title="Reset zoom"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-white/20 mx-1" />

        {/* Action buttons */}
        <button
          onClick={handleCopyUrl}
          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          title={t("imageCopyUrl") || "Copy URL"}
        >
          <Copy className="w-5 h-5" />
        </button>

        <button
          onClick={handleDownload}
          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          title={t("studioDownload") || "Download"}
        >
          <Download className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-white/20 mx-1" />

        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          title={t("imageClose") || "Close"}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image container */}
      <div
        className="relative max-w-[90vw] max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={sanitizeImageUrl(imageUrl)}
          alt={imageAlt || "Generated image"}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-transform duration-200"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          draggable={false}
        />
      </div>

      {/* Prompt display at bottom */}
      {prompt && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-2xl px-6 py-3 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white/80 text-sm font-mono leading-relaxed line-clamp-3">
            &quot;{prompt}&quot;
          </p>
        </div>
      )}
    </div>
  );
}

export default React.memo(ImageLightbox);
