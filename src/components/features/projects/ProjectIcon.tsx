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
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Map icon id to Lucide component
const ICON_MAP: Record<string, LucideIcon> = {
  folder: Folder,
  "folder-open": FolderOpen,
  book: BookOpen,
  briefcase: Briefcase,
  target: Target,
  rocket: Rocket,
  lightbulb: Lightbulb,
  zap: Zap,
  flask: FlaskConical,
  palette: Palette,
  chart: BarChart3,
  star: Star,
};

interface ProjectIconProps {
  /** Icon ID from project (e.g., "flask", "zap") or emoji */
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
 * Renders a project icon - either as Lucide icon or emoji
 */
export function ProjectIcon({ icon, color, size = "sm", className }: ProjectIconProps) {
  const IconComponent = icon ? ICON_MAP[icon] : Folder;
  const sizes = SIZE_MAP[size];

  // If icon is a Lucide icon name
  if (IconComponent) {
    return (
      <span
        className={cn(
          sizes.wrapper,
          "flex items-center justify-center rounded shrink-0",
          className
        )}
        style={{ backgroundColor: color || "#6366f1" }}
      >
        <IconComponent className={cn(sizes.icon, "text-white")} />
      </span>
    );
  }

  // Fallback: render as emoji or text
  return (
    <span
      className={cn(
        sizes.wrapper,
        "flex items-center justify-center rounded text-xs shrink-0",
        className
      )}
      style={{ backgroundColor: color || "#6366f1" }}
    >
      {icon || "📁"}
    </span>
  );
}

export default ProjectIcon;
