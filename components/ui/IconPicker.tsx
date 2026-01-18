"use client";

import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";

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
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  const handleSelect = (icon: string) => {
    onSelect(icon);
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="ml-1.5 px-1.5 py-0.5 text-xs rounded bg-white/5 hover:bg-white/10 border border-white/10 text-(--text-secondary) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Select Icon"
      >
        ▼
      </button>

      {isOpen &&
        ReactDOM.createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
            <div
              ref={dropdownRef}
              className="fixed z-[9999] p-2 rounded-lg bg-neutral-900 border border-neutral-700 shadow-xl"
              style={{ top: position.top, left: position.left }}
            >
              <div className="grid grid-cols-6 gap-1">
                {ICON_LIST.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(icon);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-white/10 transition-colors"
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
