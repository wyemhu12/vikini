// /app/features/chat/components/ImageLightbox.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
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

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-(--overlay) backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-(--z-modal) flex items-center justify-center outline-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <Dialog.Title className="sr-only">
            {imageAlt || t("imageFullscreen") || t("imagePreviewTitle")}
          </Dialog.Title>

          {/* Toolbar */}
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-(--overlay) backdrop-blur-md rounded-full border border-(--on-overlay)/10 shadow-xl z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Zoom controls */}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="p-2 rounded-full hover:bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:text-(--on-overlay) disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              title={t("studioZoomOut")}
              aria-label={t("studioZoomOut")}
            >
              <ZoomOut aria-hidden="true" className="w-5 h-5" />
            </button>

            <span className="text-(--on-overlay)/80 text-sm font-mono min-w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="p-2 rounded-full hover:bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:text-(--on-overlay) disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              title={t("studioZoomIn")}
              aria-label={t("studioZoomIn")}
            >
              <ZoomIn aria-hidden="true" className="w-5 h-5" />
            </button>

            <div className="w-px h-6 bg-(--on-overlay)/20 mx-1" />

            <button
              type="button"
              onClick={handleResetZoom}
              className="p-2 rounded-full hover:bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:text-(--on-overlay) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              title={t("studioZoomReset")}
              aria-label={t("studioZoomReset")}
            >
              <RotateCcw aria-hidden="true" className="w-5 h-5" />
            </button>

            <div className="w-px h-6 bg-(--on-overlay)/20 mx-1" />

            {/* Action buttons */}
            <button
              type="button"
              onClick={handleCopyUrl}
              className="p-2 rounded-full hover:bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:text-(--on-overlay) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              title={t("imageCopyUrl")}
              aria-label={t("imageCopyUrl")}
            >
              <Copy aria-hidden="true" className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-full hover:bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:text-(--on-overlay) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              title={t("studioDownload")}
              aria-label={t("studioDownload")}
            >
              <Download aria-hidden="true" className="w-5 h-5" />
            </button>

            <div className="w-px h-6 bg-(--on-overlay)/20 mx-1" />

            <Dialog.Close asChild>
              <button
                type="button"
                className="p-2 rounded-full hover:bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:text-(--on-overlay) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                title={t("close")}
                aria-label={t("close")}
              >
                <X aria-hidden="true" className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Image container */}
          <div
            className="relative max-w-[90vw] max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={sanitizeImageUrl(imageUrl)}
              alt={imageAlt || t("imagePreviewTitle")}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-(--shadow-elevated) transition-transform duration-200"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
              draggable={false}
            />
          </div>

          {/* Prompt display at bottom */}
          {prompt && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-2xl px-6 py-3 bg-(--overlay) backdrop-blur-md rounded-xl border border-(--on-overlay)/10 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-(--on-overlay)/80 text-sm font-mono leading-relaxed line-clamp-3">
                &quot;{prompt}&quot;
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default React.memo(ImageLightbox);
