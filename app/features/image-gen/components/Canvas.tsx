"use client";

import { Download, ExternalLink, ImageIcon, Sparkles, RefreshCcw, Trash2 } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";

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
  onRemix: (image: GeneratedImage) => void;
  onDelete: (id: string) => void;
}

export default function Canvas({ images, generating, onRemix, onDelete }: CanvasProps) {
  const { t } = useLanguage();

  return (
    <div className="flex-1 bg-(--surface-base) h-full pt-4 px-8 pb-8 flex flex-col gap-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("studioResults")}</h3>
        <span className="text-sm text-muted-foreground">
          {images.length} {t("studioImagesGenerated")}
        </span>
      </div>

      <div className="flex-1 columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6 pb-20">
        {generating && (
          <div className="break-inside-avoid mb-6 aspect-square rounded-xl bg-(--surface-elevated) border border-(--border) flex flex-col items-center justify-center animate-pulse">
            <ImageIcon className="w-12 h-12 text-muted-foreground/50 mb-2" />
            <span className="text-muted-foreground text-sm">{t("studioGenerating")}</span>
          </div>
        )}

        {images.map((item, idx) => (
          <div
            key={idx}
            className="break-inside-avoid mb-6 group relative rounded-xl overflow-hidden border border-(--border) bg-black shadow-sm hover:shadow-xl transition-all duration-300"
          >
            <img
              src={item.url}
              alt={`Generated ${item.prompt}`}
              className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />

            {/* Overlay with Controls */}
            <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/40 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
              {/* Top Metadata Badges */}
              <div className="flex flex-wrap gap-2 transform -translate-y-2 group-hover:translate-y-0 transition-transform duration-300 content-start relative w-full">
                {item.model && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-500/80 text-white border border-white/10 backdrop-blur-md">
                    {item.model}
                  </span>
                )}
                {item.aspectRatio && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-black/60 text-white border border-white/10 backdrop-blur-md">
                    {item.aspectRatio}
                  </span>
                )}
                {item.enhancer && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-linear-to-r from-pink-500 to-purple-500 text-white border border-white/10 backdrop-blur-md flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Magic
                  </span>
                )}

                {/* Top Right Actions */}
                <div className="ml-auto flex gap-2">
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
              <div className="flex flex-col gap-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                {/* Scrollable Prompt */}
                <div className="max-h-[140px] overflow-y-auto custom-scrollbar bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 shadow-lg">
                  <p className="text-white/90 text-xs font-medium leading-relaxed font-mono">
                    "{item.prompt}"
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onRemix(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/80 hover:bg-purple-600 text-white backdrop-blur-md transition-colors border border-purple-400/30 text-xs font-bold shadow-lg shadow-purple-900/40"
                    title={t("studioReuse")}
                  >
                    <RefreshCcw className="w-3 h-3" /> {t("studioReuse")}
                  </button>

                  <div className="flex gap-2">
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
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors border border-white/5"
                      title={t("studioDownload")}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => window.open(item.url, "_blank")}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors border border-white/5"
                      title={t("studioFullscreen")}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!generating && images.length === 0 && (
          <div className="col-span-full h-96 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-(--border) rounded-xl bg-(--surface-muted)/50">
            <div className="w-16 h-16 rounded-full bg-(--surface-elevated) flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-medium">{t("studioNoImages")}</p>
            <p className="text-sm opacity-70">{t("studioNoImagesDesc")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
