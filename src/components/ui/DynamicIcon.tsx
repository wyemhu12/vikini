"use client";

import React from "react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface DynamicIconProps {
  name?: string | null;
  fallback?: React.ReactNode;
  className?: string;
}

/** Normalizes Lucide icon identifiers (PascalCase, kebab-case, snake_case) for lookup. */
export function normalizeIconName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, "");
}

const ASCII_SLUG_RE = /^[a-zA-Z0-9_-]{2,}$/;

// Build a normalized case/separator-insensitive map of Lucide icon components
const ICON_LOOKUP: Record<string, React.ComponentType<{ className?: string }>> = {};

for (const [key, value] of Object.entries(Icons)) {
  if (
    /^[A-Z]/.test(key) &&
    (typeof value === "function" || (typeof value === "object" && value !== null))
  ) {
    ICON_LOOKUP[normalizeIconName(key)] = value as React.ComponentType<{ className?: string }>;
  }
}

/**
 * DynamicIcon renders a Lucide icon if `name` matches a Lucide icon name (PascalCase or kebab-case),
 * an emoji / Unicode symbol if `name` is a visual symbol, or `fallback` (or Sparkles) for empty / unknown slugs.
 */
export function DynamicIcon({ name, fallback = null, className = "w-4 h-4" }: DynamicIconProps) {
  if (!name || typeof name !== "string" || name.trim() === "") {
    return fallback ? <>{fallback}</> : null;
  }

  const trimmed = name.trim();
  const normalized = normalizeIconName(trimmed);

  const IconComponent = ICON_LOOKUP[normalized];
  if (IconComponent) {
    return <IconComponent className={className} />;
  }

  // Prevent unknown multi-char ASCII slugs (e.g. "unknown-long-slug") from spilling raw text
  if (ASCII_SLUG_RE.test(trimmed)) {
    return fallback ? <>{fallback}</> : <Icons.Sparkles className={className} />;
  }

  // Emoji or single symbol
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center select-none leading-none overflow-hidden max-w-full",
        className
      )}
    >
      {trimmed}
    </span>
  );
}

export default DynamicIcon;
