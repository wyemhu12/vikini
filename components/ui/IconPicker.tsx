"use client";

import { useState, useRef, useEffect } from "react";

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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (icon: string) => {
    onSelect(icon);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="ml-1.5 px-1.5 py-0.5 text-xs rounded bg-white/5 hover:bg-white/10 border border-white/10 text-(--text-secondary) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Select Icon"
      >
        ▼
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 p-2 rounded-lg bg-neutral-900 border border-neutral-700 shadow-xl min-w-[200px]">
          <div className="grid grid-cols-6 gap-1">
            {ICON_LIST.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => handleSelect(icon)}
                className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-white/10 transition-colors"
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
