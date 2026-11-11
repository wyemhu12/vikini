// /app/features/image-gen/components/AspectRatioPicker.tsx
"use client";

import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export interface AspectRatioPickerProps {
  value: string;
  onChange: (ratio: string) => void;
  /** Ratios always visible. */
  ratios: readonly string[];
  /** Less common ratios, collapsed behind a toggle. */
  extendedRatios?: readonly string[];
  /** Accessible name of the radiogroup. */
  label: string;
  extendedLabel: string;
}

const LONG_EDGE = 22;
const MIN_EDGE = 6;

/** Pixel size of the little frame that previews a ratio such as "16:9". */
export function ratioBox(ratio: string): { width: number; height: number } {
  const [w, h] = ratio.split(":").map((n) => Number.parseFloat(n) || 1);
  if (w >= h) {
    return { width: LONG_EDGE, height: Math.max(MIN_EDGE, Math.round((LONG_EDGE * h) / w)) };
  }
  return { width: Math.max(MIN_EDGE, Math.round((LONG_EDGE * w) / h)), height: LONG_EDGE };
}

/** Aspect-ratio cards as a radiogroup with roving focus (Vikini 3.0 phase 4B, canvas ImageStudio). */
export function AspectRatioPicker({
  value,
  onChange,
  ratios,
  extendedRatios = [],
  label,
  extendedLabel,
}: AspectRatioPickerProps) {
  const [expandedByUser, setExpandedByUser] = useState(false);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const expanded = expandedByUser || extendedRatios.includes(value);
  const visible = expanded ? [...ratios, ...extendedRatios] : [...ratios];
  const focusable = visible.includes(value) ? value : visible[0];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !backward) return;
    e.preventDefault();
    const current = Math.max(0, visible.indexOf(focusable));
    const next = visible[(current + (forward ? 1 : -1) + visible.length) % visible.length];
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="grid grid-cols-5 gap-1.5"
      >
        {visible.map((ratio) => {
          const checked = ratio === value;
          return (
            <button
              key={ratio}
              ref={(el) => {
                refs.current[ratio] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={ratio === focusable ? 0 : -1}
              onClick={() => onChange(ratio)}
              className={cn(
                "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] border text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
                checked
                  ? "border-(--accent) bg-(--soft) font-semibold text-(--accent)"
                  : "border-(--line) font-medium text-(--muted) hover:border-(--accent) hover:text-(--text)"
              )}
            >
              <span
                aria-hidden="true"
                className="rounded-[3px] border-[1.5px] border-current"
                style={ratioBox(ratio)}
              />
              {ratio}
            </button>
          );
        })}
      </div>
      {extendedRatios.length > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpandedByUser((v) => !v)}
          className="text-xs font-medium text-(--accent) transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) rounded"
        >
          {expanded ? "▾" : "▸"} {extendedLabel} ({extendedRatios.length})
        </button>
      )}
    </div>
  );
}
