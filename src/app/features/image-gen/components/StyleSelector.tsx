"use client";

import { cn } from "@/lib/utils/cn";
import { Palette, Camera, Clapperboard, Brush, MonitorPlay } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";

interface StyleSelectorProps {
  selectedStyle: string;
  onSelect: (style: string) => void;
}

export default function StyleSelector({ selectedStyle, onSelect }: StyleSelectorProps) {
  const { t } = useLanguage();

  const STYLES = [
    { id: "none", labelKey: "styleNone", icon: Palette, color: "bg-gray-500" },
    { id: "photorealistic", labelKey: "stylePhoto", icon: Camera, color: "bg-blue-500" },
    { id: "anime", labelKey: "styleAnime", icon: MonitorPlay, color: "bg-pink-500" },
    { id: "digital-art", labelKey: "styleDigital", icon: Brush, color: "bg-purple-500" },
    { id: "cinematic", labelKey: "styleCinema", icon: Clapperboard, color: "bg-amber-600" },
    { id: "3d-render", labelKey: "style3d", icon: Palette, color: "bg-emerald-500" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {STYLES.map((s) => {
        const Icon = s.icon;
        const isSelected = selectedStyle === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              "group flex flex-col items-center justify-between p-3 rounded-xl border transition-all duration-200 h-24 relative overflow-hidden",
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-md"
                : "border-(--border) bg-(--surface-elevated) hover:bg-(--surface-hover) hover:border-(--control-border)"
            )}
          >
            <div
              className={cn(
                "p-2.5 rounded-full text-white shadow-sm transition-transform group-hover:scale-110",
                s.color
              )}
            >
              <Icon size={18} />
            </div>
            <span
              className={cn(
                "text-xs font-medium w-full text-center transition-colors",
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
  );
}
