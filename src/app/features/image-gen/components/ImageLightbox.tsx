"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Pencil,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { GeneratedImage } from "./Canvas";

interface ImageLightboxProps {
  images: GeneratedImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onRemix: (image: GeneratedImage) => void;
  onEdit: (image: GeneratedImage) => void;
  onDelete: (id: string) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;
const SWIPE_THRESHOLD = 50;

export default function ImageLightbox({
  images,
  currentIndex,
  onClose,
  onNavigate,
  onRemix,
  onEdit,
  onDelete,
}: ImageLightboxProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartScroll = useRef({ x: 0, y: 0 });

  const currentImage = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  // Reset zoom/pan on image change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Auto-focus container for keyboard events
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(s + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(s - ZOOM_STEP, MIN_ZOOM);
      if (next === MIN_ZOOM) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const navigatePrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(currentIndex - 1);
    }
  }, [hasPrev, currentIndex, onNavigate]);

  const navigateNext = useCallback(() => {
    if (hasNext) {
      onNavigate(currentIndex + 1);
    }
  }, [hasNext, currentIndex, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigatePrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          navigateNext();
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
          e.preventDefault();
          zoomOut();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, navigatePrev, navigateNext, zoomIn, zoomOut]);

  // Scroll wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    },
    [zoomIn, zoomOut]
  );

  // Pan when zoomed — mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale <= 1) return;
      e.preventDefault();
      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      dragStartScroll.current = { x: position.x, y: position.y };
    },
    [scale, position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || scale <= 1) return;
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      setPosition({
        x: dragStartScroll.current.x + dx,
        y: dragStartScroll.current.y + dy,
      });
    },
    [isDragging, scale]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Double-click to reset zoom
  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2);
    }
  }, [scale, resetZoom]);

  // Mobile swipe navigation
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (scale > 1) return; // Don't navigate when zoomed
      if (info.offset.x > SWIPE_THRESHOLD && hasPrev) {
        navigatePrev();
      } else if (info.offset.x < -SWIPE_THRESHOLD && hasNext) {
        navigateNext();
      }
    },
    [scale, hasPrev, hasNext, navigatePrev, navigateNext]
  );

  const handleDownload = useCallback(() => {
    if (!currentImage) return;
    const link = document.createElement("a");
    link.href = currentImage.url;
    link.download = `generated-${Date.now()}.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentImage]);

  // Format counter text
  const counterText = t("studioImageOf")
    .replace("{current}", String(currentIndex + 1))
    .replace("{total}", String(images.length));

  if (!currentImage) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        tabIndex={-1}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex flex-col outline-none"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/90 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 py-3">
          {/* Counter */}
          <span className="text-white/80 text-sm font-medium">{counterText}</span>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={zoomOut}
              disabled={scale <= MIN_ZOOM}
              className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={t("imageZoomOut")}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-white/60 text-xs font-mono min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={scale >= MAX_ZOOM}
              className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={t("imageZoomIn")}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {scale > 1 && (
              <button
                onClick={resetZoom}
                className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title={t("studioZoomReset")}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={t("imageClose")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main image area */}
        <div
          className="relative z-10 flex-1 flex items-center justify-center overflow-hidden px-12 md:px-20"
          onWheel={handleWheel}
        >
          {/* Navigation: Previous */}
          {hasPrev && (
            <button
              onClick={navigatePrev}
              className="absolute left-2 md:left-4 z-20 p-2 md:p-3 rounded-full bg-black/40 hover:bg-black/60 text-white/70 hover:text-white transition-all backdrop-blur-sm border border-white/10"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}

          {/* Image with zoom/pan */}
          <motion.div
            drag={scale <= 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="flex items-center justify-center w-full h-full"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative"
                style={{
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onDoubleClick={handleDoubleClick}
              >
                <img
                  src={currentImage.url}
                  alt={currentImage.prompt}
                  className="max-h-[80vh] max-w-full object-contain rounded-lg select-none"
                  draggable={false}
                />
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Navigation: Next */}
          {hasNext && (
            <button
              onClick={navigateNext}
              className="absolute right-2 md:right-4 z-20 p-2 md:p-3 rounded-full bg-black/40 hover:bg-black/60 text-white/70 hover:text-white transition-all backdrop-blur-sm border border-white/10"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}
        </div>

        {/* Bottom info bar */}
        <div className="relative z-10 bg-black/60 backdrop-blur-md border-t border-white/10 px-4 py-3">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center gap-3">
            {/* Prompt & badges */}
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-sm truncate mb-1.5">
                &quot;{currentImage.prompt}&quot;
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentImage.model && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/80 text-white border border-white/10">
                    {currentImage.model}
                  </span>
                )}
                {currentImage.aspectRatio && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/60 text-white border border-white/10">
                    {currentImage.aspectRatio}
                  </span>
                )}
                {currentImage.style && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/60 text-white border border-white/10">
                    {currentImage.style}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onRemix(currentImage)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors",
                  "bg-purple-500/80 hover:bg-purple-600 text-white border border-purple-400/30"
                )}
                title={t("studioReuse")}
              >
                <RefreshCcw className="w-3 h-3" />
                {t("studioReuse")}
              </button>
              <button
                onClick={() => onEdit(currentImage)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/5"
                title={t("studioEdit")}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDownload}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/5"
                title={t("studioDownload")}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              {currentImage.id && (
                <button
                  onClick={() => onDelete(currentImage.id!)}
                  className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/80 text-red-200 hover:text-white transition-colors border border-red-500/20"
                  title={t("galleryDeleteImage")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
