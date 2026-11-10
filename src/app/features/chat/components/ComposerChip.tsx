// /app/features/chat/components/ComposerChip.tsx
"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ComposerChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  /** Toggle state. Only toggles pass it, so menu triggers never expose aria-pressed. */
  pressed?: boolean;
  /** Menu trigger that currently holds a value (e.g. a Gem is applied). */
  active?: boolean;
}

/** Pill-shaped composer control shared by toggles and menu triggers (Vikini 3.0, H2). */
export const ComposerChip = React.forwardRef<HTMLButtonElement, ComposerChipProps>(
  ({ icon: Icon, pressed, active = false, className, children, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:cursor-not-allowed disabled:opacity-45",
        pressed
          ? "border-(--accent) bg-(--soft) text-(--accent)"
          : active
            ? "border-(--accent) text-(--accent) hover:bg-(--raised)"
            : "border-(--line) text-(--muted) hover:bg-(--raised) hover:text-(--text)",
        className
      )}
      {...rest}
    >
      {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </button>
  )
);
ComposerChip.displayName = "ComposerChip";
