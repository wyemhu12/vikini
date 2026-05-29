"use client";

import {
  Download,
  ExternalLink,
  ImageIcon,
  Sparkles,
  RefreshCcw,
  Trash2,
  Lightbulb,
  Clock,
  Pencil,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";

export interface GeneratedImage {
  id?: string;
  url: string;
  prompt: string;
  aspectRatio?: string;
  style?: string;
  model?: string;
  enhancer?: boolean;
}

// Curated prompt suggestions by category - rotates based on time
const PROMPT_SUGGESTIONS = [
  {
    prompt: "A serene Japanese garden at golden hour with koi fish swimming in a crystal pond",
    icon: "🏯",
  },
  { prompt: "Cyberpunk cityscape with neon signs reflected in rain puddles at night", icon: "🌃" },
  { prompt: "A fluffy cat wearing a tiny astronaut helmet floating in space", icon: "🐱" },
  { prompt: "Ethereal watercolor painting of northern lights over snow mountains", icon: "🎨" },
  { prompt: "Macro photography of a dewdrop on a rose petal with bokeh background", icon: "📸" },
  {
    prompt: "Steampunk mechanical owl perched on ancient books in a candlelit library",
    icon: "🦉",
  },
  { prompt: "Minimalist flat design of a futuristic smart home interior", icon: "🏠" },
  { prompt: "Underwater scene with bioluminescent jellyfish in deep ocean", icon: "🪼" },
  { prompt: "A cozy cabin in the woods during autumn with warm light from windows", icon: "🍂" },
  { prompt: "Fantasy dragon made of clouds soaring through a sunset sky", icon: "🐉" },
  { prompt: "Vintage film photography style portrait of a woman in 1960s Paris", icon: "🎞️" },
  { prompt: "Isometric 3D render of a tiny floating island with a treehouse", icon: "🏝️" },
];

interface CanvasProps {
  images: GeneratedImage[];
  generating: boolean;
  onRemix: (image: GeneratedImage) => void;
  onDelete: (id: string) => void;
  onEdit?: (image: GeneratedImage) => void;
  onImageClick?: (image: GeneratedImage, index: number) => void;
  onSuggestPrompt?: (prompt: string) => void;
  className?: string;
}

export default function Canvas({
  images,
  generating,
  onRemix,
  onDelete,
  onEdit,
  onImageClick,
  onSuggestPrompt,
  className,
}: CanvasProps) {
  const { t } = useLanguage();

  // Dynamic suggestions: pick 4 based on current hour (rotates every 6 hours)
  const suggestions = useMemo(() => {
    const hourBlock = Math.floor(new Date().getHours() / 6);
    const startIdx = (hourBlock * 4) % PROMPT_SUGGESTIONS.length;
    const result = [];
    for (let i = 0; i < 4; i++) {
      result.push(PROMPT_SUGGESTIONS[(startIdx + i) % PROMPT_SUGGESTIONS.length]);
    }
    return result;
  }, []);

  // Get recent unique prompts from generated images (up to 3)
  const recentPrompts = useMemo(() => {
    const seen = new Set<string>();
    return images
      .filter((img) => {
        if (seen.has(img.prompt)) return false;
        seen.add(img.prompt);
        return true;
      })
      .slice(0, 3)
      .map((img) => img.prompt);
  }, [images]);

  return (
    <div
      className={`flex-1 min-h-0 bg-(--surface-base) pt-4 px-4 md:px-6 lg:px-8 pb-8 flex flex-col gap-4 md:gap-6 overflow-y-auto ${className || ""}`}
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
                className="break-inside-avoid mb-4 md:mb-6 aspect-square rounded-xl border border-(--border) flex flex-col items-center justify-center overflow-hidden relative"
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
                  <span className="text-muted-foreground text-sm font-medium">
                    {t("studioGenerating")}
                  </span>
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
                    <p className="text-white/90 text-[11px] font-medium leading-relaxed font-mono">
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
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = item.url;
                          link.download = `generated-${Date.now()}.png`;
                          link.target = "_blank";
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
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

      {/* Empty state - outside columns layout so it doesn't get split */}
      {!generating && images.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 flex flex-col items-center justify-center py-8 md:py-16"
        >
          {/* Glassmorphism card */}
          <div className="relative w-full max-w-sm mx-auto">
            {/* Gradient glow behind card */}
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-pink-500/20 rounded-3xl blur-2xl opacity-60" />

            <div className="relative bg-(--surface-elevated)/80 backdrop-blur-xl border border-(--border) rounded-2xl p-6 md:p-8 text-center shadow-2xl">
              {/* Animated icon */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center"
              >
                <ImageIcon className="w-8 h-8 text-purple-400" />
              </motion.div>

              <h3 className="text-lg font-bold text-(--text-primary) mb-2">
                {t("studioEmptyTitle")}
              </h3>
              <p className="text-sm text-(--text-secondary) mb-6 leading-relaxed">
                {t("studioEmptyDesc")}
              </p>

              {/* Recent prompts section */}
              {recentPrompts.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2.5 justify-center">
                    <Clock className="w-3.5 h-3.5 text-(--text-secondary)" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">
                      {t("studioRecentPrompts")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {recentPrompts.map((prompt, i) => (
                      <motion.button
                        key={`recent-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.1 }}
                        onClick={() => onSuggestPrompt?.(prompt)}
                        className="group/chip text-left w-full px-3 py-2 rounded-xl bg-(--surface-muted)/60 hover:bg-purple-500/10 border border-(--border) hover:border-purple-500/30 transition-all text-xs text-(--text-secondary) hover:text-(--text-primary) truncate"
                      >
                        <span className="truncate">&ldquo;{prompt}&rdquo;</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested prompts */}
              <div>
                <div className="flex items-center gap-2 mb-2.5 justify-center">
                  <Lightbulb className="w-3.5 h-3.5 text-(--text-secondary)" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">
                    {t("studioSuggestedPrompts")}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {suggestions.map((sug, i) => (
                    <motion.button
                      key={`sug-${i}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      onClick={() => onSuggestPrompt?.(sug.prompt)}
                      className="group/chip flex items-center gap-2.5 w-full px-3 py-2 rounded-xl bg-(--surface-muted)/60 hover:bg-purple-500/10 border border-(--border) hover:border-purple-500/30 transition-all text-left"
                    >
                      <span className="text-sm shrink-0">{sug.icon}</span>
                      <span className="text-xs text-(--text-secondary) group-hover/chip:text-(--text-primary) transition-colors line-clamp-2">
                        {sug.prompt}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
