"use client";

import React from "react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface DynamicIconProps {
  name?: string | null;
  fallback?: React.ReactNode;
  className?: string;
}

// Build a normalized case-insensitive map of Lucide icon components
const ICON_LOOKUP: Record<string, React.ComponentType<{ className?: string }>> = {};

for (const [key, value] of Object.entries(Icons)) {
  if (typeof value === "function" || (typeof value === "object" && value !== null)) {
    ICON_LOOKUP[key.toLowerCase()] = value as React.ComponentType<{ className?: string }>;
  }
}

/**
 * DynamicIcon renders a Lucide icon if `name` matches a Lucide icon name (case-insensitive),
 * an emoji / Unicode symbol if `name` is a text symbol, or `fallback` if empty / missing.
 */
export function DynamicIcon({ name, fallback = null, className = "w-4 h-4" }: DynamicIconProps) {
  if (!name || typeof name !== "string" || name.trim() === "") {
    return fallback ? <>{fallback}</> : null;
  }

  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  const IconComponent = ICON_LOOKUP[lower];
  if (IconComponent) {
    return <IconComponent className={className} />;
  }

  // Not a Lucide icon name, render as emoji / text
  return (
    <span
      className={cn("inline-flex items-center justify-center select-none leading-none", className)}
    >
      {trimmed}
    </span>
  );
}

export default DynamicIcon;
