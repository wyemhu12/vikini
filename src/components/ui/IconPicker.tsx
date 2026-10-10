"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { Sparkles, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

interface IconPickerProps {
  value?: string;
  onSelect: (icon: string) => void;
  disabled?: boolean;
  className?: string;
}

const LUCIDE_ICONS = [
  "Lightbulb",
  "Target",
  "Palette",
  "Flame",
  "Diamond",
  "Sparkles",
  "Rocket",
  "BookOpen",
  "Laptop",
  "Music",
  "Gamepad2",
  "Star",
  "Zap",
  "Wand2",
  "Drama",
  "Camera",
  "Clapperboard",
  "Rainbow",
  "Gift",
  "FileEdit",
  "Wrench",
  "Settings",
  "GraduationCap",
  "Globe",
  "Heart",
  "Brain",
  "Bot",
  "MessageCircle",
  "BarChart3",
  "Dice5",
];

const EMOJI_ICONS = [
  "💡",
  "🤖",
  "🎨",
  "🎯",
  "⚡",
  "🚀",
  "📚",
  "💻",
  "🎵",
  "🎮",
  "⭐",
  "💎",
  "🔥",
  "🧠",
  "💬",
  "📊",
  "⚖️",
  "🔬",
  "✍️",
  "🛠️",
  "🌟",
  "🪄",
  "🎭",
  "🌍",
];

export default function IconPicker({ value = "", onSelect, disabled, className }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  const handleSelect = (icon: string) => {
    onSelect(icon);
    setOpen(false);
  };

  const isSelected = (iconName: string) => {
    if (!value) return false;
    return value.toLowerCase() === iconName.toLowerCase();
  };

  return (
    <div className="relative flex items-center w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={value ? `${t("icon")}: ${value}` : t("selectIcon")}
            className={cn(
              "w-full h-[38px] px-3 flex items-center justify-between gap-2 rounded-md",
              "bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--border)",
              "text-(--text-primary) text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
              "disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer",
              className,
              value && "pr-14"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {value ? (
                <DynamicIcon name={value} className="w-5 h-5 text-(--text-primary)" />
              ) : (
                <Sparkles className="w-4 h-4 text-(--text-secondary)" />
              )}
              <span className="truncate text-xs text-(--text-secondary)">
                {value ? value : t("selectIcon")}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <ChevronDown className="w-3.5 h-3.5 text-(--text-secondary)" />
            </div>
          </button>
        </PopoverTrigger>

        {/* Nút Clear Icon đặt ngoài trigger button, là button anh em (sibling) độc lập */}
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSelect("");
              setOpen(false);
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-(--control-bg-hover) text-(--text-secondary) hover:text-(--danger) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            title={t("clearIcon")}
            aria-label={t("clearIcon")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <PopoverContent
          className="w-72 max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))] p-3 bg-(--surface-elevated) border-(--border) shadow-xl rounded-xl z-(--z-popover) max-h-80 overflow-y-auto custom-scrollbar"
          align="start"
          sideOffset={6}
        >
          <div className="space-y-3">
            {/* Lucide Icons */}
            <div>
              <div className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider mb-1.5">
                {t("icon")}
              </div>
              <div className="grid grid-cols-6 gap-1">
                {LUCIDE_ICONS.map((iconName) => {
                  const active = isSelected(iconName);
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => handleSelect(iconName)}
                      className={cn(
                        "w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
                        active
                          ? "bg-(--accent)/20 text-(--accent) border border-(--accent)/40"
                          : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover)"
                      )}
                      title={iconName}
                    >
                      <DynamicIcon name={iconName} className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Emojis */}
            <div>
              <div className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider mb-1.5">
                Emojis
              </div>
              <div className="grid grid-cols-6 gap-1">
                {EMOJI_ICONS.map((emoji) => {
                  const active = isSelected(emoji);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSelect(emoji)}
                      className={cn(
                        "w-9 h-9 flex items-center justify-center text-base rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
                        active
                          ? "bg-(--accent)/20 border border-(--accent)/40"
                          : "hover:bg-(--control-bg-hover)"
                      )}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
