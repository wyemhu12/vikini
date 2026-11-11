"use client";

import Link from "next/link";
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
  Shuffle,
  Heart,
  Link2,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { motion, AnimatePresence } from "framer-motion";
import { IMAGE_TEMPLATES, type ImageTemplate } from "@/lib/features/image-gen/templates";
import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/utils/logger";
import TagInput from "./TagInput";

// Dynamic loading message keys - cycle every 2.5s
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
    case "3:2":
      return "aspect-[3/2]";
    case "2:3":
      return "aspect-[2/3]";
    case "21:9":
      return "aspect-[21/9]";
    case "5:4":
      return "aspect-[5/4]";
    case "4:5":
      return "aspect-[4/5]";
    case "1:4":
      return "aspect-[1/4]";
    case "4:1":
      return "aspect-[4/1]";
    case "1:8":
      return "aspect-[1/8]";
    case "8:1":
      return "aspect-[8/1]";
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
  // QW2: Enhanced Prompt Transparency
  originalPrompt?: string;
  enhancedPrompt?: string;
  // QW4: Favorites
  isFavorite?: boolean;
  // MT2: Version Chain
  parentMessageId?: string;
  editDepth?: number;
  // MT3: Tags
  tags?: string[];
  // P2-1: AI comment from interleaved text+image output
  aiComment?: string;
  // API-04: Storage path for multi-turn editing without base64
  storagePath?: string;
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
  onVariation?: (image: GeneratedImage) => void;
  onToggleFavorite?: (image: GeneratedImage) => void;
  onTagsUpdated?: () => void;
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
  onVariation,
  onToggleFavorite,
  onTagsUpdated,
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
      className={`flex-1 bg-(--surface) h-full pt-4 px-4 md:px-6 lg:px-8 pb-8 flex flex-col gap-4 md:gap-6 overflow-y-auto ${className || ""}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("studioResults")}</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-(--muted)">
            {images.length} {t("studioImagesGenerated")}
          </span>
          <Link
            href="/gallery"
            className="font-medium text-(--accent) hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            {t("studioViewLibrary")}
          </Link>
        </div>
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
                    <Sparkles className="w-10 h-10 text-(--accent) mb-3" />
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
              initial={{ opacity: 0, transform: "translateY(20px)" }}
              animate={{ opacity: 1, transform: "translateY(0)" }}
              transition={{ duration: 0.3, ease: "easeOut", delay: Math.min(idx * 0.08, 0.4) }}
              className="break-inside-avoid mb-4 md:mb-6 group relative rounded-xl overflow-hidden border border-(--border) bg-(--surface-elevated) shadow-sm hover:shadow-xl transition-shadow duration-300"
            >
              <img
                src={item.url}
                alt={`Generated ${item.prompt}`}
                className="w-full h-auto object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02] cursor-pointer"
                loading="lazy"
                onClick={() => onImageClick?.(item, idx)}
              />

              {/* P2-1: AI Comment */}
              {item.aiComment && (
                <div className="px-3 py-2 text-xs text-(--text-secondary) italic bg-(--surface-muted)/50 border-t border-(--border) line-clamp-2 hover:line-clamp-none transition-colors cursor-pointer">
                  {item.aiComment}
                </div>
              )}

              {/* Overlay with Controls */}
              <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/40 to-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 overflow-y-auto overflow-x-hidden">
                {/* Top Metadata Badges */}
                <div className="flex flex-wrap gap-1.5 transform -translate-y-2 group-hover:translate-y-0 group-focus-within:translate-y-0 transition-transform duration-300 content-start relative w-full shrink-0">
                  {item.model && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-black/60 text-white border border-white/10 backdrop-blur-md">
                      {item.model}
                    </span>
                  )}
                  {item.aspectRatio && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-black/60 text-white border border-white/10 backdrop-blur-md">
                      {item.aspectRatio}
                    </span>
                  )}
                  {/* QW2: Enhanced badge with tooltip */}
                  {item.enhancer && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded bg-(--accent) text-(--on-accent) border border-white/10 backdrop-blur-md flex items-center gap-1 cursor-help"
                      title={
                        item.enhancedPrompt
                          ? `${t("studioEnhancedPrompt")}: ${item.enhancedPrompt}`
                          : undefined
                      }
                    >
                      <Sparkles className="w-3 h-3" /> {t("studioEnhancedBadge")}
                    </span>
                  )}
                  {/* MT2: Version chain badge */}
                  {item.editDepth && item.editDepth > 0 && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded bg-(--warning) text-white border border-white/10 backdrop-blur-md flex items-center gap-1 cursor-help"
                      title={t("studioVersionTooltip")}
                    >
                      <Link2 className="w-3 h-3" />{" "}
                      {t("studioVersionBadge").replace("{depth}", String(item.editDepth))}
                    </span>
                  )}

                  {/* Top Right Actions - Favorite + Delete */}
                  <div className="ml-auto flex gap-1.5">
                    {/* QW4: Favorite toggle */}
                    {item.id && onToggleFavorite && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(item);
                        }}
                        className={`p-1.5 rounded-full backdrop-blur-md transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) ${
                          item.isFavorite
                            ? "bg-(--accent) text-(--on-accent) border-(--accent) shadow-lg"
                            : "bg-white/10 hover:bg-black/60 text-white/70 hover:text-white border-white/10"
                        }`}
                        title={item.isFavorite ? t("studioUnfavorite") : t("studioFavorite")}
                      >
                        <Heart className={`w-3 h-3 ${item.isFavorite ? "fill-current" : ""}`} />
                      </button>
                    )}
                    {item.id && (
                      <button
                        onClick={() => onDelete(item.id!)}
                        className="p-1.5 rounded-full bg-black/50 hover:bg-(--danger) text-white backdrop-blur-md transition-colors border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                        title={t("galleryDeleteImage")}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Controls Area */}
                <div className="flex flex-col gap-2 transform translate-y-4 group-hover:translate-y-0 group-focus-within:translate-y-0 transition-transform duration-300 mt-auto shrink-0">
                  {/* Scrollable Prompt */}
                  <div className="max-h-[80px] overflow-y-auto custom-scrollbar bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 shadow-lg">
                    <p className="text-white/90 text-xs font-medium leading-relaxed font-mono">
                      &quot;{item.prompt}&quot;
                    </p>
                  </div>

                  {/* MT3: Tags */}
                  {item.id && onTagsUpdated && (
                    <TagInput
                      imageId={item.id}
                      currentTags={item.tags || []}
                      onTagsUpdated={onTagsUpdated}
                    />
                  )}

                  {/* Action Buttons - wraps on small screens */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => onRemix(item)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-(--accent) hover:brightness-110 text-(--on-accent) backdrop-blur-md transition-colors border border-(--accent) text-xs font-bold shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                      title={t("studioReuseTooltip")}
                    >
                      <RefreshCcw className="w-3 h-3" />{" "}
                      <span className="hidden min-[300px]:inline">{t("studioReuse")}</span>
                    </button>

                    {onEdit && (
                      <button
                        onClick={() => onEdit(item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/60 hover:bg-black/75 text-white backdrop-blur-md transition-colors border border-white/20 text-xs font-bold shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                        title={t("studioEditTooltip")}
                      >
                        <Pencil className="w-3 h-3" />{" "}
                        <span className="hidden min-[300px]:inline">{t("studioEdit")}</span>
                      </button>
                    )}

                    {/* QW3: Variation button */}
                    {onVariation && (
                      <button
                        onClick={() => onVariation(item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/60 hover:bg-black/75 text-white backdrop-blur-md transition-colors border border-white/20 text-xs font-bold shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                        title={t("studioVariationTooltip")}
                      >
                        <Shuffle className="w-3 h-3" />{" "}
                        <span className="hidden min-[300px]:inline">{t("studioVariation")}</span>
                      </button>
                    )}

                    <div className="flex gap-1.5 ml-auto">
                      <button
                        onClick={() => void downloadImage(item)}
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors border border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                        title={t("studioDownload")}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => window.open(item.url, "_blank")}
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors border border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
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

      {/* Empty state - Template Gallery */}
      {!generating && images.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="flex-1 flex flex-col py-4"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-(--soft) border border-(--accent)/30 flex items-center justify-center"
            >
              <ImageIcon className="w-7 h-7 text-(--accent)" />
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
                  initial={{ opacity: 0, transform: "scale(0.9)" }}
                  animate={{ opacity: 1, transform: "scale(1)" }}
                  transition={{ delay: idx * 0.04, duration: 0.3, ease: "easeOut" }}
                  onClick={() => onSelectTemplate?.(tmpl)}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-(--border) hover:border-(--accent) transition-colors hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-(--ring)"
                >
                  {/* Preview image */}
                  <img
                    src={tmpl.previewUrl}
                    alt={tmpl.name[language]}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
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
                      <div className="mt-1 flex items-center gap-1 whitespace-nowrap text-white/80 text-xs">
                        <ImageIcon aria-hidden="true" className="w-3 h-3 shrink-0" />
                        {t("studioNeedsPhoto")}
                      </div>
                    )}
                  </div>
                  {/* Hover border glow */}
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 group-hover:ring-(--accent)/40 transition-colors" />
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
            className="mx-auto mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full bg-(--surface-elevated) border border-(--border) hover:border-(--accent) hover:bg-(--soft) transition-colors text-xs font-medium text-(--text-secondary) hover:text-(--text-primary)"
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
