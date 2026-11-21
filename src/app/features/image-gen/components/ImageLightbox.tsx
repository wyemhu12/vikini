"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
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
import { logger } from "@/lib/utils/logger";
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

  // Keyboard navigation (Escape handled natively by Radix Dialog)
  useEffect(() => {
    if (!currentImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
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
  }, [currentImage, navigatePrev, navigateNext, zoomIn, zoomOut]);

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

  // Pan when zoomed - mouse handlers
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

  const handleDownload = useCallback(async () => {
    if (!currentImage) return;
    try {
      const response = await fetch(currentImage.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `vikini-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      logger.warn("Blob download failed, falling back to window.open:", err);
      window.open(currentImage.url, "_blank");
    }
  }, [currentImage]);

  // Format counter text
  const counterText = t("studioImageOf")
    .replace("{current}", String(currentIndex + 1))
    .replace("{total}", String(images.length));

  return (
    <Dialog.Root
      open={Boolean(currentImage)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-(--overlay) backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-(--z-modal) flex flex-col outline-none"
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {currentImage && (
            <>
              <Dialog.Title className="sr-only">
                {currentImage.prompt || t("imagePreviewTitle")}
              </Dialog.Title>

              {/* Top bar */}
              <div className="relative z-10 flex items-center justify-between px-4 py-3">
                {/* Counter */}
                <span className="text-(--on-overlay)/80 text-sm font-medium">{counterText}</span>

                {/* Zoom controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={zoomOut}
                    disabled={scale <= MIN_ZOOM}
                    className="p-2 rounded-full text-(--on-overlay)/80 hover:text-(--on-overlay) hover:bg-(--on-overlay)/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                    title={t("studioZoomOut")}
                    aria-label={t("studioZoomOut")}
                  >
                    <ZoomOut aria-hidden="true" className="w-4 h-4" />
                  </button>
                  <span className="text-(--on-overlay)/70 text-xs font-mono min-w-[3rem] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={zoomIn}
                    disabled={scale >= MAX_ZOOM}
                    className="p-2 rounded-full text-(--on-overlay)/80 hover:text-(--on-overlay) hover:bg-(--on-overlay)/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                    title={t("studioZoomIn")}
                    aria-label={t("studioZoomIn")}
                  >
                    <ZoomIn aria-hidden="true" className="w-4 h-4" />
                  </button>
                  {scale > 1 && (
                    <button
                      type="button"
                      onClick={resetZoom}
                      className="p-2 rounded-full text-(--on-overlay)/80 hover:text-(--on-overlay) hover:bg-(--on-overlay)/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                      title={t("studioZoomReset")}
                      aria-label={t("studioZoomReset")}
                    >
                      <RotateCcw aria-hidden="true" className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Close button */}
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="p-2 rounded-full text-(--on-overlay)/80 hover:text-(--on-overlay) hover:bg-(--on-overlay)/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                    title={t("close")}
                    aria-label={t("close")}
                  >
                    <X aria-hidden="true" className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Main image area */}
              <div
                className="relative z-10 flex-1 flex items-center justify-center overflow-hidden px-12 md:px-20"
                onWheel={handleWheel}
                onClick={(e) => {
                  if (e.target === e.currentTarget) onClose();
                }}
              >
                {/* Navigation: Previous */}
                {hasPrev && (
                  <button
                    type="button"
                    onClick={navigatePrev}
                    aria-label={t("previousImage")}
                    title={t("previousImage")}
                    className="absolute left-2 md:left-4 z-20 p-2 md:p-3 rounded-full bg-(--overlay) hover:bg-(--on-overlay)/20 text-(--on-overlay)/80 hover:text-(--on-overlay) transition-colors backdrop-blur-sm border border-(--on-overlay)/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                  >
                    <ChevronLeft aria-hidden="true" className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                )}

                {/* Image with zoom/pan */}
                <motion.div
                  drag={scale <= 1 ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={handleDragEnd}
                  className="flex items-center justify-center w-full h-full"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) onClose();
                  }}
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
                    type="button"
                    onClick={navigateNext}
                    aria-label={t("nextImage")}
                    title={t("nextImage")}
                    className="absolute right-2 md:right-4 z-20 p-2 md:p-3 rounded-full bg-(--overlay) hover:bg-(--on-overlay)/20 text-(--on-overlay)/80 hover:text-(--on-overlay) transition-colors backdrop-blur-sm border border-(--on-overlay)/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                  >
                    <ChevronRight aria-hidden="true" className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                )}
              </div>

              {/* Bottom info bar */}
              <div className="relative z-10 bg-(--overlay) backdrop-blur-md border-t border-(--on-overlay)/10 px-4 py-3">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center gap-3">
                  {/* Prompt & badges */}
                  <div className="flex-1 min-w-0">
                    <p className="text-(--on-overlay)/85 text-sm truncate mb-1.5">
                      &quot;{currentImage.prompt}&quot;
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {currentImage.model && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-(--accent) text-(--on-accent) border border-(--accent)/30">
                          {currentImage.model}
                        </span>
                      )}
                      {currentImage.aspectRatio && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-(--overlay) text-(--on-overlay) border border-(--on-overlay)/15">
                          {currentImage.aspectRatio}
                        </span>
                      )}
                      {currentImage.style && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-(--accent) text-(--on-accent) border border-(--accent)/30">
                          {currentImage.style}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRemix(currentImage)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-[filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
                        "bg-(--accent) hover:brightness-110 text-(--on-accent) border border-(--accent)/30"
                      )}
                      title={t("studioReuse")}
                    >
                      <RefreshCcw aria-hidden="true" className="w-3 h-3" />
                      {t("studioReuse")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(currentImage)}
                      className="p-2 rounded-full bg-(--on-overlay)/10 hover:bg-(--on-overlay)/20 text-(--on-overlay) transition-colors border border-(--on-overlay)/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                      title={t("studioEdit")}
                      aria-label={t("studioEdit")}
                    >
                      <Pencil aria-hidden="true" className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="p-2 rounded-full bg-(--on-overlay)/10 hover:bg-(--on-overlay)/20 text-(--on-overlay) transition-colors border border-(--on-overlay)/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                      title={t("studioDownload")}
                      aria-label={t("studioDownload")}
                    >
                      <Download aria-hidden="true" className="w-3.5 h-3.5" />
                    </button>
                    {currentImage.id && (
                      <button
                        type="button"
                        onClick={() => onDelete(currentImage.id!)}
                        className="p-2 rounded-full bg-(--danger)/20 hover:bg-(--danger) text-(--danger) hover:text-(--danger-foreground) transition-colors border border-(--danger)/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                        title={t("galleryDeleteImage")}
                        aria-label={t("galleryDeleteImage")}
                      >
                        <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
