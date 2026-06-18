"use client";

import {
  Download,
  ExternalLink,
  ImageIcon,
  Sparkles,
  RefreshCcw,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { motion, AnimatePresence } from "framer-motion";
import { IMAGE_TEMPLATES, type ImageTemplate } from "@/lib/features/image-gen/templates";
import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/utils/logger";

// Dynamic loading message keys — cycle every 2.5s
const LOADING_MESSAGE_KEYS = [
  "studioLoadingMixColors",
  "studioLoadingDrawDetails",
  "studioLoadingPolishing",
  "studioLoadingAlmostDone",
  "studioLoadingCreating",
] as const;

// Map aspect ratio string to Tailwind aspect class
function getAspectClass(ratio?: string): string {
  switch (ratio) {
    case "16:9":
      return "aspect-video";
    case "9:16":
      return "aspect-[9/16]";
    case "4:3":
      return "aspect-[4/3]";
    case "3:4":
      return "aspect-[3/4]";
    case "1:1":
    default:
      return "aspect-square";
  }
}

export interface GeneratedImage {
  id?: string;
  url: string;
  prompt: string;
  aspectRatio?: string;
  style?: string;
  model?: string;
  enhancer?: boolean;
}

interface CanvasProps {
  images: GeneratedImage[];
  generating: boolean;
  selectedAspectRatio?: string;
  onRemix: (image: GeneratedImage) => void;
  onDelete: (id: string) => void;
  onEdit?: (image: GeneratedImage) => void;
  onImageClick?: (image: GeneratedImage, index: number) => void;
  onSelectTemplate?: (template: ImageTemplate) => void;
  className?: string;
}

export default function Canvas({
  images,
  generating,
  selectedAspectRatio,
  onRemix,
  onDelete,
  onEdit,
  onImageClick,
  onSelectTemplate,
  className,
}: CanvasProps) {
  const { t, language } = useLanguage();
  const [templatesExpanded, setTemplatesExpanded] = useState(false);

  // Dynamic loading message cycling
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  useEffect(() => {
    if (!generating) {
      setLoadingMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGE_KEYS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [generating]);

  // Proper blob download to handle CORS with signed URLs
  const downloadImage = useCallback(async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `vikini-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      logger.warn("Blob download failed, falling back to window.open:", err);
      window.open(image.url, "_blank");
    }
  }, []);

  return (
    <div
      className={`flex-1 bg-(--surface-base) h-full pt-4 px-4 md:px-6 lg:px-8 pb-8 flex flex-col gap-4 md:gap-6 overflow-y-auto ${className || ""}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("studioResults")}</h3>
        <span className="text-sm text-muted-foreground">
          {images.length} {t("studioImagesGenerated")}
        </span>
      </div>

      {/* Image grid - only render columns layout when there are images */}
      {(generating || images.length > 0) && (
        <div className="flex-1 columns-1 md:columns-2 xl:columns-3 gap-4 md:gap-6 space-y-4 md:space-y-6 pb-20">
          {/* Generating skeleton with shimmer */}
          <AnimatePresence>
            {generating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`break-inside-avoid mb-4 md:mb-6 ${getAspectClass(selectedAspectRatio)} rounded-xl border border-(--border) flex flex-col items-center justify-center overflow-hidden relative`}
              >
                {/* Shimmer background */}
                <div className="absolute inset-0 shimmer-block" />
                <div className="relative z-10 flex flex-col items-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-10 h-10 text-purple-400 mb-3" />
                  </motion.div>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={loadingMsgIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.3 }}
                      className="text-muted-foreground text-sm font-medium"
                    >
                      {t(LOADING_MESSAGE_KEYS[loadingMsgIndex])}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Image cards with stagger animation */}
          {images.map((item, idx) => (
            <motion.div
              key={item.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(idx * 0.08, 0.4) }}
              className="break-inside-avoid mb-4 md:mb-6 group relative rounded-xl overflow-hidden border border-(--border) bg-(--surface-elevated) shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <img
                src={item.url}
                alt={`Generated ${item.prompt}`}
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105 cursor-pointer"
                loading="lazy"
                onClick={() => onImageClick?.(item, idx)}
              />

              {/* Quick download — always visible */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void downloadImage(item);
                }}
                className="absolute bottom-2 right-2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-sm transition-all opacity-70 hover:opacity-100 z-10 shadow-lg"
                title={t("studioDownload")}
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Overlay with Controls */}
              <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/40 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 overflow-y-auto overflow-x-hidden">
                {/* Top Metadata Badges */}
                <div className="flex flex-wrap gap-1.5 transform -translate-y-2 group-hover:translate-y-0 transition-transform duration-300 content-start relative w-full shrink-0">
                  {item.model && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/80 text-white border border-white/10 backdrop-blur-md">
                      {item.model}
                    </span>
                  )}
                  {item.aspectRatio && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/60 text-white border border-white/10 backdrop-blur-md">
                      {item.aspectRatio}
                    </span>
                  )}
                  {item.enhancer && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-linear-to-r from-pink-500 to-purple-500 text-white border border-white/10 backdrop-blur-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Magic
                    </span>
                  )}

                  {/* Top Right Actions */}
                  <div className="ml-auto flex gap-1.5">
                    {item.id && (
                      <button
                        onClick={() => onDelete(item.id!)}
                        className="p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/80 text-red-200 hover:text-white backdrop-blur-md transition-all border border-red-500/20"
                        title={t("galleryDeleteImage")}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Controls Area */}
                <div className="flex flex-col gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 mt-auto shrink-0">
                  {/* Scrollable Prompt */}
                  <div className="max-h-[80px] overflow-y-auto custom-scrollbar bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 shadow-lg">
                    <p className="text-white/90 text-xs font-medium leading-relaxed font-mono">
                      &quot;{item.prompt}&quot;
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => onRemix(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/80 hover:bg-purple-600 text-white backdrop-blur-md transition-colors border border-purple-400/30 text-xs font-bold shadow-lg shadow-purple-900/40 shrink-0"
                      title={t("studioReuse")}
                    >
                      <RefreshCcw className="w-3 h-3" /> {t("studioReuse")}
                    </button>

                    {onEdit && (
                      <button
                        onClick={() => onEdit(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/80 hover:bg-blue-600 text-white backdrop-blur-md transition-colors border border-blue-400/30 text-xs font-bold shadow-lg shadow-blue-900/40 shrink-0"
                        title={t("studioEdit")}
                      >
                        <Pencil className="w-3 h-3" /> {t("studioEdit")}
                      </button>
                    )}

                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => void downloadImage(item)}
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors border border-white/5"
                        title={t("studioDownload")}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => window.open(item.url, "_blank")}
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors border border-white/5"
                        title={t("studioFullscreen")}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state — Template Gallery */}
      {!generating && images.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 flex flex-col py-4"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center"
            >
              <ImageIcon className="w-7 h-7 text-purple-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-(--text-primary) mb-1">
              {t("studioEmptyTitle")}
            </h3>
            <p className="text-sm text-(--text-secondary)">{t("studioEmptySubtitle")}</p>
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {(templatesExpanded ? IMAGE_TEMPLATES : IMAGE_TEMPLATES.slice(0, 6)).map(
              (tmpl, idx) => (
                <motion.button
                  key={tmpl.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.04, duration: 0.3 }}
                  onClick={() => onSelectTemplate?.(tmpl)}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-(--border) hover:border-purple-500/40 transition-all hover:shadow-lg hover:shadow-purple-500/10 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                >
                  {/* Preview image */}
                  <img
                    src={tmpl.previewUrl}
                    alt={tmpl.name[language]}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {/* Name label */}
                  <div className="absolute bottom-0 inset-x-0 p-2.5">
                    <span className="text-white text-xs font-bold drop-shadow-lg">
                      {tmpl.name[language]}
                    </span>
                    {tmpl.requiresPhoto && (
                      <div className="mt-1 flex items-center gap-1 text-white/60 text-[9px]">
                        <ImageIcon className="w-2.5 h-2.5" />
                        {t("studioNeedsPhoto")}
                      </div>
                    )}
                  </div>
                  {/* Hover border glow */}
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 group-hover:ring-purple-400/30 transition-all" />
                </motion.button>
              )
            )}
          </div>

          {/* Expand / Collapse button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => setTemplatesExpanded(!templatesExpanded)}
            className="mx-auto mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full bg-(--surface-elevated) border border-(--border) hover:border-purple-500/30 hover:bg-purple-500/5 transition-all text-xs font-medium text-(--text-secondary) hover:text-(--text-primary)"
          >
            {templatesExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                {t("studioShowLess")}
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                {t("studioShowMore").replace("{count}", String(IMAGE_TEMPLATES.length - 6))}
              </>
            )}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
