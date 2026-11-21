// /app/features/gallery/components/ImageCompareModal.tsx
"use client";

import React, { useState, useCallback } from "react";
import { X, ArrowLeftRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { useLanguage } from "../../chat/hooks/useLanguage";

// ============================================
// Type Definitions
// ============================================

interface CompareImage {
  id: string;
  url: string;
  prompt: string;
  model?: string;
  aspectRatio?: string;
}

interface ImageCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  leftImage: CompareImage | null;
  rightImage: CompareImage | null;
  onSwap: () => void;
}

// ============================================
// Constants
// ============================================

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

// ============================================
// Component
// ============================================

export function ImageCompareModal({
  isOpen,
  onClose,
  leftImage,
  rightImage,
  onSwap,
}: ImageCompareModalProps) {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(1);
  const [overlayMode, setOverlayMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setSliderPosition(50);
  }, []);

  const updateSliderPosition = useCallback((clientX: number, target: HTMLDivElement) => {
    const rect = target.getBoundingClientRect();
    if (!rect.width) return;
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  }, []);

  const handleSliderChange = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      updateSliderPosition(e.clientX, e.currentTarget);
    },
    [updateSliderPosition]
  );

  const handleTouchSliderChange = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches && e.touches.length > 0) {
        updateSliderPosition(e.touches[0].clientX, e.currentTarget);
      }
    },
    [updateSliderPosition]
  );

  if (!leftImage || !rightImage) return null;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-(--overlay) backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-(--z-modal) flex items-center justify-center outline-none"
          aria-label={t("compareTitle")}
        >
          <Dialog.Title className="sr-only">{t("compareTitle")}</Dialog.Title>

          {/* Toolbar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-[calc(100vw-1rem)] flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-(--overlay) backdrop-blur-md rounded-full border border-(--on-overlay)/10 shadow-xl z-20">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              aria-label={t("imageZoomOut")}
              className="p-1.5 sm:p-2 rounded-full hover:bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:text-(--on-overlay) disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              title={t("imageZoomOut")}
            >
              <ZoomOut aria-hidden="true" className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <span className="text-(--on-overlay)/80 text-xs sm:text-sm font-mono min-w-10 sm:min-w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label={t("imageZoomIn")}
              className="p-1.5 sm:p-2 rounded-full hover:bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:text-(--on-overlay) disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              title={t("imageZoomIn")}
            >
              <ZoomIn aria-hidden="true" className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="w-px h-5 sm:h-6 bg-(--on-overlay)/20 mx-0.5 sm:mx-1" />

            <button
              type="button"
              onClick={handleResetZoom}
              aria-label={t("studioZoomReset")}
              className="p-1.5 sm:p-2 rounded-full hover:bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:text-(--on-overlay) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              title={t("studioZoomReset")}
            >
              <RotateCcw aria-hidden="true" className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="w-px h-5 sm:h-6 bg-(--on-overlay)/20 mx-0.5 sm:mx-1" />

            <button
              type="button"
              aria-pressed={overlayMode}
              onClick={() => setOverlayMode(!overlayMode)}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) ${
                overlayMode
                  ? "bg-(--accent) text-(--on-accent)"
                  : "bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:bg-(--on-overlay)/20 hover:text-(--on-overlay)"
              }`}
            >
              {overlayMode ? t("compareOverlay") : t("compareSideBySide")}
            </button>

            <button
              type="button"
              onClick={onSwap}
              aria-label={t("compareSwap")}
              className="p-1.5 sm:p-2 rounded-full hover:bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:text-(--on-overlay) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              title={t("compareSwap")}
            >
              <ArrowLeftRight aria-hidden="true" className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="w-px h-5 sm:h-6 bg-(--on-overlay)/20 mx-0.5 sm:mx-1" />

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={t("imageClose")}
                className="p-1.5 sm:p-2 rounded-full hover:bg-(--on-overlay)/10 text-(--on-overlay)/80 hover:text-(--on-overlay) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                title={t("imageClose")}
              >
                <X aria-hidden="true" className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Main Content */}
          <div className="w-full h-full flex items-center justify-center p-4 pt-20 sm:p-16 sm:pt-20">
            {overlayMode ? (
              /* Overlay Slider Mode */
              <div
                className="relative w-full max-w-5xl aspect-square overflow-hidden rounded-xl cursor-ew-resize touch-none"
                onMouseMove={handleSliderChange}
                onClick={handleSliderChange}
                onTouchStart={handleTouchSliderChange}
                onTouchMove={handleTouchSliderChange}
              >
                {/* Right Image (Background) */}
                <div className="absolute inset-0">
                  <Image
                    src={rightImage.url}
                    alt={rightImage.prompt}
                    fill
                    className="object-contain"
                    style={{ transform: `scale(${zoom})` }}
                    unoptimized
                  />
                </div>

                {/* Left Image (Foreground with clip) */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                >
                  <Image
                    src={leftImage.url}
                    alt={leftImage.prompt}
                    fill
                    className="object-contain"
                    style={{ transform: `scale(${zoom})` }}
                    unoptimized
                  />
                </div>

                {/* Slider Line */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-(--on-overlay) shadow-lg cursor-ew-resize"
                  style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-(--surface) border border-(--line) shadow-lg flex items-center justify-center">
                    <ArrowLeftRight aria-hidden="true" className="w-4 h-4 text-(--text)" />
                  </div>
                </div>

                {/* Labels */}
                <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 max-w-[44%] truncate px-2.5 sm:px-3 py-1 sm:py-1.5 bg-(--overlay) backdrop-blur-sm rounded-lg text-(--on-overlay) text-xs sm:text-sm font-medium">
                  {leftImage.model || t("compareImageA")}
                </div>
                <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 max-w-[44%] truncate px-2.5 sm:px-3 py-1 sm:py-1.5 bg-(--overlay) backdrop-blur-sm rounded-lg text-(--on-overlay) text-xs sm:text-sm font-medium">
                  {rightImage.model || t("compareImageB")}
                </div>
              </div>
            ) : (
              /* Side by Side Mode */
              <div className="flex gap-4 w-full max-w-7xl h-full items-center justify-center">
                {/* Left Image */}
                <div className="flex-1 flex flex-col items-center gap-4">
                  <div
                    className="relative w-full aspect-square max-h-[70vh] rounded-xl overflow-hidden bg-(--overlay) border border-(--on-overlay)/10"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                  >
                    <Image
                      src={leftImage.url}
                      alt={leftImage.prompt}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="text-center max-w-md">
                    <div className="px-3 py-1.5 bg-(--accent)/20 text-(--accent) rounded-full text-xs font-bold inline-block mb-2">
                      {leftImage.model || t("compareImageA")}
                    </div>
                    <p className="text-(--on-overlay)/70 text-sm line-clamp-2">
                      {leftImage.prompt}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="flex flex-col items-center gap-2">
                  <div className="h-32 w-px bg-(--on-overlay)/20" />
                  <span className="text-(--on-overlay)/50 text-xs font-bold">VS</span>
                  <div className="h-32 w-px bg-(--on-overlay)/20" />
                </div>

                {/* Right Image */}
                <div className="flex-1 flex flex-col items-center gap-4">
                  <div
                    className="relative w-full aspect-square max-h-[70vh] rounded-xl overflow-hidden bg-(--overlay) border border-(--on-overlay)/10"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                  >
                    <Image
                      src={rightImage.url}
                      alt={rightImage.prompt}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="text-center max-w-md">
                    <div className="px-3 py-1.5 bg-(--accent)/20 text-(--accent) rounded-full text-xs font-bold inline-block mb-2">
                      {rightImage.model || t("compareImageB")}
                    </div>
                    <p className="text-(--on-overlay)/70 text-sm line-clamp-2">
                      {rightImage.prompt}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-(--overlay) backdrop-blur-sm rounded-full text-(--on-overlay)/60 text-xs">
            {overlayMode
              ? t("compareOverlayHint") || "Drag slider to compare • Click to toggle mode"
              : t("compareSideBySideHint") || "Side by side view • Use zoom controls above"}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ImageCompareModal;
