import React from "react";
import { cn } from "@/lib/utils/cn";

export interface VikiniLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<VikiniLogoProps["size"]>, string> = {
  sm: "h-8 w-8 rounded-lg text-xl",
  md: "h-10 w-10 rounded-xl text-2xl",
  lg: "h-16 w-16 rounded-2xl text-4xl",
};

/** Unified Vikini 3.0 brand mark (italic Newsreader lowercase "v"). */
export function VikiniLogo({ size = "sm", className }: VikiniLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center bg-(--text) font-serif italic leading-none text-(--bg)",
        SIZE_CLASSES[size],
        className
      )}
    >
      v
    </span>
  );
}

export default VikiniLogo;
