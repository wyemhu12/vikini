"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface IconPickerProps {
  onSelect: (icon: string) => void;
  disabled?: boolean;
}

const ICON_LIST = [
  "💡",
  "🎯",
  "🎨",
  "🔥",
  "💎",
  "✨",
  "🚀",
  "📚",
  "💻",
  "🎵",
  "🎮",
  "🌟",
  "⚡",
  "🔮",
  "🎭",
  "📷",
  "🎬",
  "🌈",
  "🎁",
  "📝",
  "🔧",
  "⚙️",
  "🎓",
  "🌍",
  "❤️",
  "🧠",
  "🤖",
  "💬",
  "📊",
  "🎲",
];

export default function IconPicker({ onSelect, disabled }: IconPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (icon: string) => {
    onSelect(icon);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="ml-1.5 px-1.5 py-0.5 text-xs rounded bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-(--text-secondary) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Select Icon"
        >
          ▼
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-6 gap-1">
          {ICON_LIST.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => handleSelect(icon)}
              className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-(--control-bg-hover) transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-(--primary)"
            >
              {icon}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
