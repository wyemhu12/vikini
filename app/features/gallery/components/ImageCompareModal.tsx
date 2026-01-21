// /app/features/gallery/components/ImageCompareModal.tsx
"use client";

import React, { useState, useCallback } from "react";
import { X, ArrowLeftRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import Image from "next/image";
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

  const handleSliderChange = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  }, []);

  if (!isOpen || !leftImage || !rightImage) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-xl z-20"
        onClick={(e) => e.stopPropagation()}
      >
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
          title="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-white/20 mx-1" />

        <button
          onClick={() => setOverlayMode(!overlayMode)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            overlayMode
              ? "bg-purple-500/80 text-white"
              : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
          }`}
        >
          {overlayMode
            ? t("compareOverlay") || "Overlay"
            : t("compareSideBySide") || "Side by Side"}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSwap();
          }}
          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          title={t("compareSwap") || "Swap images"}
        >
          <ArrowLeftRight className="w-5 h-5" />
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

      {/* Main Content */}
      <div
        className="w-full h-full flex items-center justify-center p-16 pt-20"
        onClick={(e) => e.stopPropagation()}
      >
        {overlayMode ? (
          /* Overlay Slider Mode */
          <div
            className="relative w-full max-w-5xl aspect-square overflow-hidden rounded-xl cursor-ew-resize"
            onMouseMove={handleSliderChange}
            onClick={handleSliderChange}
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
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
              style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                <ArrowLeftRight className="w-4 h-4 text-gray-700" />
              </div>
            </div>

            {/* Labels */}
            <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-white text-sm font-medium">
              {leftImage.model || "Image A"}
            </div>
            <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-white text-sm font-medium">
              {rightImage.model || "Image B"}
            </div>
          </div>
        ) : (
          /* Side by Side Mode */
          <div className="flex gap-4 w-full max-w-7xl h-full items-center justify-center">
            {/* Left Image */}
            <div className="flex-1 flex flex-col items-center gap-4">
              <div
                className="relative w-full aspect-square max-h-[70vh] rounded-xl overflow-hidden bg-black/40 border border-white/10"
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
                <div className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-bold inline-block mb-2">
                  {leftImage.model || "Image A"}
                </div>
                <p className="text-white/70 text-sm line-clamp-2">{leftImage.prompt}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="flex flex-col items-center gap-2">
              <div className="h-32 w-px bg-white/20" />
              <span className="text-white/50 text-xs font-bold">VS</span>
              <div className="h-32 w-px bg-white/20" />
            </div>

            {/* Right Image */}
            <div className="flex-1 flex flex-col items-center gap-4">
              <div
                className="relative w-full aspect-square max-h-[70vh] rounded-xl overflow-hidden bg-black/40 border border-white/10"
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
                <div className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-full text-xs font-bold inline-block mb-2">
                  {rightImage.model || "Image B"}
                </div>
                <p className="text-white/70 text-sm line-clamp-2">{rightImage.prompt}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full text-white/60 text-xs">
        {overlayMode
          ? t("compareOverlayHint") || "Drag slider to compare • Click to toggle mode"
          : t("compareSideBySideHint") || "Side by side view • Use zoom controls above"}
      </div>
    </div>
  );
}

export default ImageCompareModal;
