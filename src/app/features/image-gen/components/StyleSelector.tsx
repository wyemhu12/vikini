"use client";

import { cn } from "@/lib/utils/cn";
import {
  Palette,
  Camera,
  Clapperboard,
  Brush,
  MonitorPlay,
  Box,
  Droplet,
  PaintBucket,
  PenTool,
  Zap,
  Minimize2,
  Eye,
  Grid3x3,
  Triangle,
  Cog,
  Binary,
  Swords,
  Flower2,
  Search,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useState } from "react";

interface StyleSelectorProps {
  selectedStyle: string;
  onSelect: (style: string) => void;
}

const STYLES = [
  { id: "none", labelKey: "styleNone", icon: Palette, color: "bg-gray-500" },
  { id: "photorealistic", labelKey: "stylePhoto", icon: Camera, color: "bg-blue-500" },
  { id: "anime", labelKey: "styleAnime", icon: MonitorPlay, color: "bg-pink-500" },
  { id: "digital-art", labelKey: "styleDigital", icon: Brush, color: "bg-purple-500" },
  { id: "cinematic", labelKey: "styleCinema", icon: Clapperboard, color: "bg-amber-600" },
  { id: "3d-render", labelKey: "style3d", icon: Box, color: "bg-emerald-500" },
  // --- New styles (MT5) ---
  { id: "watercolor", labelKey: "styleWatercolor", icon: Droplet, color: "bg-cyan-500" },
  { id: "oil-painting", labelKey: "styleOilPainting", icon: PaintBucket, color: "bg-orange-600" },
  { id: "sketch-pencil", labelKey: "styleSketch", icon: PenTool, color: "bg-gray-400" },
  { id: "pop-art", labelKey: "stylePopArt", icon: Zap, color: "bg-red-500" },
  { id: "minimalist", labelKey: "styleMinimalist", icon: Minimize2, color: "bg-slate-500" },
  { id: "surrealist", labelKey: "styleSurrealist", icon: Eye, color: "bg-violet-600" },
  { id: "pixel-art", labelKey: "stylePixelArt", icon: Grid3x3, color: "bg-green-500" },
  { id: "isometric", labelKey: "styleIsometric", icon: Triangle, color: "bg-teal-500" },
  { id: "low-poly", labelKey: "styleLowPoly", icon: Triangle, color: "bg-lime-600" },
  { id: "steampunk", labelKey: "styleSteampunk", icon: Cog, color: "bg-yellow-700" },
  { id: "cyberpunk", labelKey: "styleCyberpunk", icon: Binary, color: "bg-fuchsia-600" },
  { id: "fantasy-art", labelKey: "styleFantasy", icon: Swords, color: "bg-indigo-600" },
  { id: "art-nouveau", labelKey: "styleArtNouveau", icon: Flower2, color: "bg-rose-500" },
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
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("styleSearch") || "Search styles..."}
          className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-(--control-bg) border border-(--control-border) text-[11px] text-(--text-primary) placeholder:text-(--text-secondary) focus:outline-none focus:ring-1 focus:ring-purple-500/40"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-0.5">
        {filteredStyles.map((s) => {
          const Icon = s.icon;
          const isSelected = selectedStyle === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                "group flex flex-col items-center justify-between p-2.5 rounded-xl border transition-all duration-200 h-20 relative overflow-hidden",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-md"
                  : "border-(--border) bg-(--surface-elevated) hover:bg-(--surface-hover) hover:border-(--control-border)"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-full text-white shadow-sm transition-transform group-hover:scale-110",
                  s.color
                )}
              >
                <Icon size={14} />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium w-full text-center transition-colors leading-tight",
                  isSelected ? "text-primary" : "text-(--text-secondary)"
                )}
              >
                {t(s.labelKey)}
              </span>

              {isSelected && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
