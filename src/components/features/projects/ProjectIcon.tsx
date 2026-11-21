"use client";

import React from "react";
import {
  Folder,
  FolderOpen,
  BookOpen,
  Briefcase,
  Target,
  Rocket,
  Lightbulb,
  Zap,
  FlaskConical,
  Palette,
  BarChart3,
  Star,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Map normalized icon id to Lucide component
const ICON_MAP: Record<string, LucideIcon> = {
  folder: Folder,
  "folder-open": FolderOpen,
  folderopen: FolderOpen,
  book: BookOpen,
  bookopen: BookOpen,
  briefcase: Briefcase,
  target: Target,
  rocket: Rocket,
  lightbulb: Lightbulb,
  zap: Zap,
  flask: FlaskConical,
  palette: Palette,
  chart: BarChart3,
  star: Star,
  sparkles: Sparkles,
};

const ASCII_SLUG_RE = /^[a-zA-Z0-9_-]{2,}$/;

interface ProjectIconProps {
  /** Icon ID from project (e.g., "flask", "sparkles") or emoji */
  icon?: string | null;
  /** Background color */
  color?: string | null;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional className */
  className?: string;
}

const SIZE_MAP = {
  sm: { wrapper: "w-5 h-5", icon: "h-3 w-3" },
  md: { wrapper: "w-6 h-6", icon: "h-3.5 w-3.5" },
  lg: { wrapper: "w-8 h-8", icon: "h-4 w-4" },
};

/**
 * Renders a project icon — Lucide icon, emoji, or Folder fallback for empty/unknown ASCII slugs.
 */
export function ProjectIcon({ icon, color, size = "sm", className }: ProjectIconProps) {
  const trimmed = icon?.trim() ?? "";
  const lower = trimmed.toLowerCase();
  const compact = lower.replace(/[-_\s]+/g, "");
  const IconComponent =
    !trimmed || ASCII_SLUG_RE.test(trimmed)
      ? ICON_MAP[lower] || ICON_MAP[compact] || Folder
      : undefined;
  const sizes = SIZE_MAP[size];

  if (IconComponent) {
    return (
      <span
        className={cn(
          sizes.wrapper,
          "flex items-center justify-center rounded shrink-0 overflow-hidden",
          className
        )}
        style={{ backgroundColor: color || "#6366f1" }}
      >
        <IconComponent aria-hidden className={cn(sizes.icon, "text-(--on-overlay)")} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        sizes.wrapper,
        "flex items-center justify-center rounded text-xs shrink-0 overflow-hidden",
        className
      )}
      style={{ backgroundColor: color || "#6366f1" }}
    >
      {trimmed}
    </span>
  );
}

export default ProjectIcon;
