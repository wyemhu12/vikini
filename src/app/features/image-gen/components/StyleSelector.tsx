"use client";

import { cn } from "@/lib/utils/cn";
import { Palette, Search } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useState } from "react";

interface StyleSelectorProps {
  selectedStyle: string;
  onSelect: (style: string) => void;
}

// Style preview image map - maps style id to /styles/ image path
const STYLE_THUMBNAILS: Record<string, string> = {
  photorealistic: "/styles/style_photorealistic.png",
  anime: "/styles/style_anime.png",
  "digital-art": "/styles/style_digital_art.png",
  cinematic: "/styles/style_cinematic.png",
  "3d-render": "/styles/style_3d_render.png",
  watercolor: "/styles/style_watercolor.png",
  "oil-painting": "/styles/style_oil_painting.png",
  "sketch-pencil": "/styles/style_sketch.png",
  "pop-art": "/styles/style_pop_art.png",
  minimalist: "/styles/style_minimalist.png",
  surrealist: "/styles/style_surrealist.png",
  "pixel-art": "/styles/style_pixel_art.png",
  isometric: "/styles/style_isometric.png",
  "low-poly": "/styles/style_low_poly.png",
  steampunk: "/styles/style_steampunk.png",
  cyberpunk: "/styles/style_cyberpunk.png",
  "fantasy-art": "/styles/style_fantasy_art.png",
  "art-nouveau": "/styles/style_art_nouveau.png",
};

const STYLES = [
  { id: "none", labelKey: "styleNone" },
  { id: "photorealistic", labelKey: "stylePhoto" },
  { id: "anime", labelKey: "styleAnime" },
  { id: "digital-art", labelKey: "styleDigital" },
  { id: "cinematic", labelKey: "styleCinema" },
  { id: "3d-render", labelKey: "style3d" },
  { id: "watercolor", labelKey: "styleWatercolor" },
  { id: "oil-painting", labelKey: "styleOilPainting" },
  { id: "sketch-pencil", labelKey: "styleSketch" },
  { id: "pop-art", labelKey: "stylePopArt" },
  { id: "minimalist", labelKey: "styleMinimalist" },
  { id: "surrealist", labelKey: "styleSurrealist" },
  { id: "pixel-art", labelKey: "stylePixelArt" },
  { id: "isometric", labelKey: "styleIsometric" },
  { id: "low-poly", labelKey: "styleLowPoly" },
  { id: "steampunk", labelKey: "styleSteampunk" },
  { id: "cyberpunk", labelKey: "styleCyberpunk" },
  { id: "fantasy-art", labelKey: "styleFantasy" },
  { id: "art-nouveau", labelKey: "styleArtNouveau" },
] as const;

export default function StyleSelector({ selectedStyle, onSelect }: StyleSelectorProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStyles = searchQuery
    ? STYLES.filter(
        (s) => s.id === "none" || t(s.labelKey).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : STYLES;

  return (
    <div className="space-y-2">
      {/* Search when many styles */}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-(--muted)"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("styleSearch") || "Search styles..."}
          aria-label={t("styleSearch") || "Search styles"}
          className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-(--raised) border border-(--line) text-xs text-(--text) placeholder:text-(--muted) focus:outline-none focus:ring-1 focus:ring-(--ring)"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-0.5">
        {filteredStyles.map((s) => {
          const isSelected = selectedStyle === s.id;
          const thumbnail = STYLE_THUMBNAILS[s.id];
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(s.id)}
              className={cn(
                "group flex flex-col items-center justify-end rounded-xl border transition-colors duration-200 h-24 relative overflow-hidden",
                isSelected
                  ? "border-(--accent) ring-2 ring-(--accent)/50 shadow-lg"
                  : "border-(--line) hover:border-(--accent) hover:shadow-md"
              )}
            >
              {/* Thumbnail background or gradient fallback */}
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                /* "None" style - icon fallback */
                <div className="absolute inset-0 bg-(--raised) flex items-center justify-center">
                  <Palette aria-hidden="true" className="w-8 h-8 text-(--muted) opacity-40" />
                </div>
              )}

              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {/* Label */}
              <span
                className={cn(
                  "relative z-10 text-xs font-semibold w-full text-center px-1 pb-1.5 transition-colors leading-tight drop-shadow-md",
                  isSelected ? "text-white" : "text-white/90"
                )}
              >
                {t(s.labelKey)}
              </span>

              {/* Selected indicator */}
              {isSelected && (
                <div
                  aria-hidden="true"
                  className="absolute top-1 right-1 w-3 h-3 rounded-full bg-(--accent) border-2 border-white shadow-md z-10"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
